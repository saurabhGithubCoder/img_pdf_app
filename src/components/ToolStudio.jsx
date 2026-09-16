import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ArrowRight,
  Download,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileText,
  Loader2,
  Check,
  RotateCw,
  GripVertical,
  Sliders,
  TrendingDown,
  RotateCcw,
  Image as ImageIcon,
  Code,
  Info,
  SlidersHorizontal,
  Plus,
  Type,
  Presentation,
  Sheet,
  FileCode,
  RefreshCw,
  RectangleVertical,
  RectangleHorizontal,
  Square,
  Maximize2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  KeyRound,
  Wand2,
  AlertTriangle,
  Crop as CropIcon,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize,
  Settings,
  Pen,
  SquareCheck,
  CircleDot,
  ListOrdered,
  ChevronDown as ChevronDownIcon,
  AlignLeft,
  Move,
  X as CloseIcon,
  SlidersVertical,
  ScanText
} from 'lucide-react';
import {
  mergePDFs,
  splitPDF,
  rotatePDF,
  imagesToPDF,
  pdfToJpg,
  pdfToMarkdown,
  renderPdfThumbnails,
  renderSinglePdfPage,
  cropPDF,
  removePagesFromPDF,
  extractPagesFromPDF,
  reorganizePDF,
  compressPDF,
  convertWordToPDF,
  convertPowerpointToPDF,
  convertHtmlToPDF,
  convertExcelToPDF,
  convertPdfToWord,
  convertPdfToPowerpoint,
  convertPdfToExcel,
  addPageNumbersToPDF,
  addWatermarkToPDF,
  protectPDF,
  unlockPDF,
  checkPdfPassword,
  checkDocxPassword,
  checkPptxPassword,
  checkExcelPassword,
  extractPdfFormFields,
  savePdfForms,
  performPdfOcr
} from '../utils/pdfWorker';
import EditPdfStudio from './EditPdfStudio';

export default function ToolStudio({ tool, initialFiles, initialImageCards, initialHtmlCode, initialHtmlMode, onBack }) {
  const [files, setFiles] = useState(initialFiles || []);
  const [imageCards, setImageCards] = useState(initialImageCards || []);
  const [htmlInputMode, setHtmlInputMode] = useState(initialHtmlMode || 'file');
  const [rawHtmlCode, setRawHtmlCode] = useState(initialHtmlCode || '');

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const changeFileInputRef = useRef(null);

  function getFileInputAccept() {
    if (tool?.id === 'jpg-to-pdf') return 'image/jpeg,image/png,image/webp';
    if (tool?.id === 'word-to-pdf') return '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';
    if (tool?.id === 'powerpoint-to-pdf') return '.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint';
    if (tool?.id === 'excel-to-pdf') return '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
    if (tool?.id === 'html-to-pdf') return '.html,.htm,text/html';
    return 'application/pdf';
  }

  // Compression tool settings
  const [compressionPercent, setCompressionPercent] = useState(45);

  // OCR Tool Settings
  const [ocrLanguage, setOcrLanguage] = useState('eng');
  const [ocrOutputMode, setOcrOutputMode] = useState('searchable_pdf'); // 'searchable_pdf' | 'text'
  const [ocrProgress, setOcrProgress] = useState({ status: '', percent: 0 });

  // Password Protection State
  const [protectPassword, setProtectPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  // Unlock PDF Options State
  const [unlockMode, setUnlockMode] = useState('without-password');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);

  // Merge PDF visual thumbnail cards & drag state
  const [mergeCards, setMergeCards] = useState([]);
  const [draggedMergeIndex, setDraggedMergeIndex] = useState(null);
  const [isLoadingMergePreviews, setIsLoadingMergePreviews] = useState(false);

  // Page-selector & Visual tools
  const isPageLevelTool =
    tool?.id === 'remove' ||
    tool?.id === 'extract' ||
    tool?.id === 'organize' ||
    tool?.id === 'rotate' ||
    tool?.id === 'page-numbers' ||
    tool?.id === 'watermark' ||
    tool?.id === 'protect' ||
    tool?.id === 'crop';

  const [thumbnails, setThumbnails] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isRenderingPages, setIsRenderingPages] = useState(false);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [rangeInput, setRangeInput] = useState('');
  const [draggedPageIndex, setDraggedPageIndex] = useState(null);
  const [draggedImageIndex, setDraggedImageIndex] = useState(null);

  // Image to PDF Options State
  const [imageToPdfOptions, setImageToPdfOptions] = useState({
    orientation: 'portrait',
    pageSize: 'a4',
    margin: 'none',
    mergeAll: true,
  });

  // Add Page Numbers Options State
  const [pageNumberOptions, setPageNumberOptions] = useState({
    pageMode: 'single',
    position: 'top-right',
    margin: 'recommended',
    firstNumber: 1,
    fromPage: 1,
    toPage: 1,
    textPreset: 'number-only',
    customText: 'Page {n} of {p}',
    fontFamily: 'Helvetica',
    fontSize: 10,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    color: '#334155'
  });

  // Add Watermark Options State
  const [watermarkOptions, setWatermarkOptions] = useState({
    type: 'text',
    text: 'CONFIDENTIAL',
    imageFile: null,
    imagePreviewUrl: '',
    position: 'middle-center',
    isMosaic: false,
    opacity: 1.0,
    rotation: 0,
    fromPage: 1,
    toPage: 1,
    layer: 'over',
    fontFamily: 'Helvetica',
    fontSize: 32,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    color: '#E11D48'
  });

  // Crop PDF Tool State
  const [cropPageMode, setCropPageMode] = useState('custom');
  const [cropCurrentPage, setCropCurrentPage] = useState(1);
  const [cropZoom, setCropZoom] = useState(68);
  const [cropPageDataUrl, setCropPageDataUrl] = useState('');
  const [pageCropBoxes, setPageCropBoxes] = useState({});
  const DEFAULT_CROP_BOX = { x: 5, y: 5, width: 90, height: 90 };
  const cropCanvasContainerRef = useRef(null);
  const cropDragState = useRef({
    isDragging: false,
    isResizing: false,
    handle: null,
    startX: 0,
    startY: 0,
    initialBox: null,
  });

  const currentActiveBox = pageCropBoxes[cropCurrentPage] || DEFAULT_CROP_BOX;
  const isCurrentPageCropped = Boolean(pageCropBoxes[cropCurrentPage]);

  const resetCurrentPageCrop = () => {
    setPageCropBoxes((prev) => {
      const updated = { ...prev };
      delete updated[cropCurrentPage];
      return updated;
    });
  };

  const updateCurrentPageCropBox = (updater) => {
    setPageCropBoxes((prev) => {
      const currentBox = prev[cropCurrentPage] || DEFAULT_CROP_BOX;
      const nextBox = typeof updater === 'function' ? updater(currentBox) : updater;
      
      if (cropPageMode === 'all') {
        const updatedAll = {};
        for (let i = 1; i <= totalPages; i++) {
          updatedAll[i] = { ...nextBox };
        }
        return updatedAll;
      }

      return {
        ...prev,
        [cropCurrentPage]: nextBox
      };
    });
  };

  const getPointerPos = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const handleCropPointerDown = (e, handle = null) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();

    const { clientX, clientY } = getPointerPos(e);

    cropDragState.current = {
      isDragging: !handle,
      isResizing: Boolean(handle),
      handle,
      startX: clientX,
      startY: clientY,
      initialBox: { ...currentActiveBox }
    };

    window.addEventListener('mousemove', handleCropPointerMove, { passive: false });
    window.addEventListener('mouseup', handleCropPointerUp);
    window.addEventListener('touchmove', handleCropPointerMove, { passive: false });
    window.addEventListener('touchend', handleCropPointerUp);
  };

  const handleCropPointerMove = (e) => {
    const { isDragging, isResizing, handle, startX, startY, initialBox } = cropDragState.current;
    if (!isDragging && !isResizing) return;
    if (!cropCanvasContainerRef.current) return;

    if (e.cancelable) e.preventDefault();

    const { clientX, clientY } = getPointerPos(e);
    const rect = cropCanvasContainerRef.current.getBoundingClientRect();
    const deltaXPercent = ((clientX - startX) / rect.width) * 100;
    const deltaYPercent = ((clientY - startY) / rect.height) * 100;

    if (isDragging) {
      const newX = Math.max(0, Math.min(100 - initialBox.width, initialBox.x + deltaXPercent));
      const newY = Math.max(0, Math.min(100 - initialBox.height, initialBox.y + deltaYPercent));
      updateCurrentPageCropBox((prev) => ({ ...prev, x: newX, y: newY }));
    } else if (isResizing) {
      let { x, y, width, height } = initialBox;

      if (handle.includes('e')) width = Math.max(5, Math.min(100 - x, width + deltaXPercent));
      if (handle.includes('s')) height = Math.max(5, Math.min(100 - y, height + deltaYPercent));
      if (handle.includes('w')) {
        const potentialWidth = width - deltaXPercent;
        if (potentialWidth >= 5 && x + deltaXPercent >= 0) {
          x += deltaXPercent;
          width = potentialWidth;
        }
      }
      if (handle.includes('n')) {
        const potentialHeight = height - deltaYPercent;
        if (potentialHeight >= 5 && y + deltaYPercent >= 0) {
          y += deltaYPercent;
          height = potentialHeight;
        }
      }
      updateCurrentPageCropBox({ x, y, width, height });
    }
  };

  const handleCropPointerUp = () => {
    cropDragState.current = { isDragging: false, isResizing: false, handle: null, startX: 0, startY: 0, initialBox: null };
    window.removeEventListener('mousemove', handleCropPointerMove);
    window.removeEventListener('mouseup', handleCropPointerUp);
    window.removeEventListener('touchmove', handleCropPointerMove);
    window.removeEventListener('touchend', handleCropPointerUp);
  };

  // PDF Forms Tool State
  const [formMode, setFormMode] = useState('fill');
  const [activeFormTool, setActiveFormTool] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [formZoom, setFormZoom] = useState(100);
  const [formPageDataUrl, setFormPageDataUrl] = useState('');
  const [formCurrentPage, setFormCurrentPage] = useState(1);
  const [formTotalPages, setFormTotalPages] = useState(1);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const [formPageDimensions, setFormPageDimensions] = useState({ width: 595, height: 842 });
  const [formViewportSize, setFormViewportSize] = useState({ width: 800, height: 600 });

  const formPageContainerRef = useRef(null);
  const formViewportScrollRef = useRef(null);
  const formFieldDragRef = useRef({ isDragging: false, isResizing: false, handle: null, fieldId: null, startX: 0, startY: 0, initialPercent: null });

  useEffect(() => {
    if (!formViewportScrollRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setFormViewportSize({ width, height });
        }
      }
    });
    observer.observe(formViewportScrollRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (tool?.id === 'forms' && files.length > 0) {
      loadInitialPdfForms(files[0]);
    }
  }, [files, tool?.id]);

  useEffect(() => {
    if (tool?.id === 'forms' && files.length > 0) {
      renderCurrentFormPage(files[0], formCurrentPage);
      if (formViewportScrollRef.current) {
        formViewportScrollRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    }
  }, [files, tool?.id, formCurrentPage]);

  const loadInitialPdfForms = async (file) => {
    setIsFormLoading(true);
    setErrorMsg('');
    try {
      const data = await extractPdfFormFields(file);
      setFormFields(data.fields || []);
      setFormTotalPages(data.totalPages || 1);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to analyze PDF form.');
    } finally {
      setIsFormLoading(false);
    }
  };

  const renderCurrentFormPage = async (file, pageNum) => {
    try {
      const data = await renderSinglePdfPage(file, pageNum, 1.8, true);
      setFormPageDataUrl(data.dataUrl);
      setFormTotalPages(data.totalPages);
      if (data.width && data.height) {
        setFormPageDimensions({ width: data.width, height: data.height });
      }
    } catch (err) {
      setErrorMsg('Failed to render form page preview.');
    }
  };

  const selectedField = formFields.find((f) => f.id === selectedFieldId);

  const updateSelectedField = (patch) => {
    if (!selectedFieldId) return;
    setFormFields((prev) =>
      prev.map((f) => (f.id === selectedFieldId ? { ...f, ...patch } : f))
    );
  };

  const deleteSelectedField = (id) => {
    setFormFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
    setIsMobileDrawerOpen(false);
  };

  const handleCanvasClickToAddField = (e) => {
    if (formMode !== 'edit' || !activeFormTool || !formPageContainerRef.current) return;
    if (e.target !== formPageContainerRef.current && !e.target.classList.contains('form-page-img')) return;

    const rect = formPageContainerRef.current.getBoundingClientRect();
    const clickXPercent = Math.max(2, Math.min(85, ((e.clientX - rect.left) / rect.width) * 100));
    const clickYPercent = Math.max(2, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100));

    let defaultWidthPercent = 24;
    let defaultHeightPercent = 3.0;

    if (activeFormTool === 'checkbox' || activeFormTool === 'radio') {
      defaultWidthPercent = 3.5;
      defaultHeightPercent = 2.2;
    } else if (activeFormTool === 'signature') {
      defaultWidthPercent = 22;
      defaultHeightPercent = 4.5;
    } else if (activeFormTool === 'listbox') {
      defaultWidthPercent = 26;
      defaultHeightPercent = 8.0;
    } else if (activeFormTool === 'formtext') {
      defaultWidthPercent = 20;
      defaultHeightPercent = 2.6;
    }

    const isTextAnnotation = activeFormTool === 'formtext';

    const newField = {
      id: `field-${Date.now()}`,
      name: isTextAnnotation
        ? `TextLabel_${formFields.length + 1}`
        : `${activeFormTool}_${formFields.length + 1}`,
      type: activeFormTool,
      page: formCurrentPage,
      xPercent: clickXPercent,
      yPercent: clickYPercent,
      widthPercent: defaultWidthPercent,
      heightPercent: defaultHeightPercent,
      value: isTextAnnotation
        ? 'Insert text here'
        : activeFormTool === 'checkbox' || activeFormTool === 'radio'
        ? false
        : '',
      options: activeFormTool === 'combobox' || activeFormTool === 'listbox' ? ['Option 1', 'Option 2', 'Option 3'] : [],
      readOnly: false,
      required: false,
      multiline: false,
      includeIndicator: activeFormTool === 'signature',
      indicatorText: activeFormTool === 'signature' ? 'Sign Here' : 'Fill Here',
      fontSize: 11,
      fontFamily: 'Helvetica',
      color: isTextAnnotation ? '#DC2626' : '#000000',
      strokeColor: '#3b82f6',
      isBold: false,
      isItalic: false,
      isUnderline: false,
    };

    setFormFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  const handleFieldPointerDown = (e, field, handle = null, isExplicitDragHandle = false) => {
    setSelectedFieldId(field.id);

    if (formMode === 'fill' && !isExplicitDragHandle && !handle) {
      return;
    }

    e.stopPropagation();
    if (e.cancelable) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    formFieldDragRef.current = {
      isDragging: !handle,
      isResizing: Boolean(handle),
      handle,
      fieldId: field.id,
      startX: clientX,
      startY: clientY,
      initialPercent: {
        x: field.xPercent,
        y: field.yPercent,
        w: field.widthPercent,
        h: field.heightPercent
      }
    };

    window.addEventListener('mousemove', handleFieldPointerMove, { passive: false });
    window.addEventListener('mouseup', handleFieldPointerUp);
    window.addEventListener('touchmove', handleFieldPointerMove, { passive: false });
    window.addEventListener('touchend', handleFieldPointerUp);
  };

  const handleFieldPointerMove = (e) => {
    const { isDragging, isResizing, handle, fieldId, startX, startY, initialPercent } = formFieldDragRef.current;
    if (!isDragging && !isResizing) return;
    if (!formPageContainerRef.current) return;

    if (e.cancelable) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = formPageContainerRef.current.getBoundingClientRect();
    const deltaXPercent = ((clientX - startX) / rect.width) * 100;
    const deltaYPercent = ((clientY - startY) / rect.height) * 100;

    setFormFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        if (isDragging) {
          const newX = Math.max(0, Math.min(100 - initialPercent.w, initialPercent.x + deltaXPercent));
          const newY = Math.max(0, Math.min(100 - initialPercent.h, initialPercent.y + deltaYPercent));
          return { ...f, xPercent: newX, yPercent: newY };
        } else if (isResizing) {
          let { x, y, w, h } = initialPercent;
          if (handle.includes('e')) w = Math.max(2, Math.min(100 - x, w + deltaXPercent));
          if (handle.includes('s')) h = Math.max(1.5, Math.min(100 - y, h + deltaYPercent));
          if (handle.includes('w')) {
            const potentialW = w - deltaXPercent;
            if (potentialW >= 2 && x + deltaXPercent >= 0) {
              x += deltaXPercent;
              w = potentialW;
            }
          }
          if (handle.includes('n')) {
            const potentialH = h - deltaYPercent;
            if (potentialH >= 1.5 && y + deltaYPercent >= 0) {
              y += deltaYPercent;
              h = potentialH;
            }
          }
          return { ...f, xPercent: x, yPercent: y, widthPercent: w, heightPercent: h };
        }
        return f;
      })
    );
  };

  const handleFieldPointerUp = () => {
    formFieldDragRef.current = { isDragging: false, isResizing: false, handle: null, fieldId: null };
    window.removeEventListener('mousemove', handleFieldPointerMove);
    window.removeEventListener('mouseup', handleFieldPointerUp);
    window.removeEventListener('touchmove', handleFieldPointerMove);
    window.removeEventListener('touchend', handleFieldPointerUp);
  };

  const availW = Math.max(100, formViewportSize.width - 24);
  const availH = Math.max(100, formViewportSize.height - 24);
  const pageW = formPageDimensions.width || 595;
  const pageH = formPageDimensions.height || 842;
  const baseScale = Math.min(availW / pageW, availH / pageH);
  const zoomFactor = formZoom / 100;
  const displayWidth = Math.round(pageW * baseScale * zoomFactor);
  const displayHeight = Math.round(pageH * baseScale * zoomFactor);

  const isOverflowingY = displayHeight > availH;
  const isOverflowingX = displayWidth > availW;

  useEffect(() => {
    if (isPageLevelTool && files.length > 0) {
      if (tool?.id === 'crop') {
        loadCropPagePreview(files[0], cropCurrentPage);
      } else {
        loadDocumentThumbnails(files[0]);
      }
    } else if (tool?.id === 'merge' && files.length > 0) {
      loadMergePreviews(files);
    }
  }, [files, tool?.id, cropCurrentPage]);

  const loadCropPagePreview = async (file, pageNum) => {
    setErrorMsg('');
    setIsRenderingPages(true);
    try {
      const data = await renderSinglePdfPage(file, pageNum, 1.6);
      setCropPageDataUrl(data.dataUrl);
      setTotalPages(data.totalPages);
    } catch (err) {
      setErrorMsg('Failed to render PDF page. The document may be corrupted.');
    } finally {
      setIsRenderingPages(false);
    }
  };

  const loadDocumentThumbnails = async (file) => {
    setErrorMsg('');
    setIsRenderingPages(true);
    setThumbnails([]);
    setSelectedPages(new Set());
    setRangeInput('');

    try {
      const data = await renderPdfThumbnails(file);
      setThumbnails(data.thumbnails);
      setTotalPages(data.totalPages);
      setPageNumberOptions((prev) => ({
        ...prev,
        fromPage: 1,
        toPage: data.totalPages
      }));
      setWatermarkOptions((prev) => ({
        ...prev,
        fromPage: 1,
        toPage: data.totalPages
      }));
    } catch (err) {
      setErrorMsg('Failed to read PDF pages. The file might be corrupted.');
    } finally {
      setIsRenderingPages(false);
    }
  };

  const loadMergePreviews = async (pdfFiles) => {
    setIsLoadingMergePreviews(true);
    try {
      const cards = await Promise.all(
        pdfFiles.map(async (file, index) => {
          try {
            const data = await renderPdfThumbnails(file);
            return {
              id: `merge-${file.name}-${index}-${Date.now()}`,
              file,
              previewUrl: data.thumbnails[0]?.dataUrl || '',
              pageCount: data.totalPages || 1
            };
          } catch {
            return {
              id: `merge-${file.name}-${index}-${Date.now()}`,
              file,
              previewUrl: '',
              pageCount: 1
            };
          }
        })
      );
      setMergeCards(cards);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMergePreviews(false);
    }
  };

  const handleReplaceDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');

    let isLocked = false;
    if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
      isLocked = await checkPdfPassword(file);
    } else if (tool?.id === 'word-to-pdf') {
      isLocked = await checkDocxPassword(file);
    } else if (tool?.id === 'powerpoint-to-pdf') {
      isLocked = await checkPptxPassword(file);
    } else if (tool?.id === 'excel-to-pdf') {
      isLocked = await checkExcelPassword(file);
    }

    if (tool?.id === 'protect' && isLocked) {
      setErrorMsg(`"${file.name}" is already password-protected.`);
      return;
    }

    if (tool?.id !== 'unlock' && isLocked) {
      setErrorMsg(`Cannot process: "${file.name}" is password-protected or encrypted.`);
      return;
    }

    setFiles([file]);
    if (result?.url) {
      URL.revokeObjectURL(result.url);
      setResult(null);
    }
    e.target.value = '';
  };

  const handleAddMorePdfs = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setErrorMsg('');
    const newFiles = Array.from(e.target.files);

    for (const f of newFiles) {
      const isLocked = await checkPdfPassword(f);
      if (isLocked) {
        setErrorMsg(`"${f.name}" is password-protected and was not added.`);
        return;
      }
    }

    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const handleAddMoreImages = (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const addedList = Array.from(e.target.files).map((file) => ({
      id: `img-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      rotation: 0
    }));
    setImageCards((prev) => [...prev, ...addedList]);
    setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    e.target.value = '';
  };

  const handleWatermarkImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setWatermarkOptions((prev) => ({
        ...prev,
        imageFile: file,
        imagePreviewUrl: URL.createObjectURL(file)
      }));
    }
  };

  const handleMergeDragStart = (e, index) => {
    setDraggedMergeIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleMergeDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleMergeDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedMergeIndex === null || draggedMergeIndex === dropIndex) return;

    const reordered = [...mergeCards];
    const [draggedItem] = reordered.splice(draggedMergeIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    setMergeCards(reordered);
    setFiles(reordered.map((c) => c.file));
    setDraggedMergeIndex(null);
  };

  const deleteMergeCard = (index) => {
    const updated = mergeCards.filter((_, idx) => idx !== index);
    setMergeCards(updated);
    setFiles(updated.map((c) => c.file));
    if (updated.length === 0) onBack();
  };

  const handleImageDragStart = (e, index) => {
    setDraggedImageIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleImageDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleImageDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedImageIndex === null || draggedImageIndex === dropIndex) return;

    const reordered = [...imageCards];
    const [draggedItem] = reordered.splice(draggedImageIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    setImageCards(reordered);
    setDraggedImageIndex(null);
  };

  const rotateImageCard = (index) => {
    const updated = [...imageCards];
    updated[index].rotation = (updated[index].rotation + 90) % 360;
    setImageCards(updated);
  };

  const deleteImageCard = (index) => {
    const updated = imageCards.filter((_, idx) => idx !== index);
    setImageCards(updated);
    setFiles(updated.map((c) => c.file));
    if (updated.length === 0) onBack();
  };

  const handlePageDragStart = (e, index) => {
    setDraggedPageIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePageDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handlePageDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedPageIndex === null || draggedPageIndex === dropIndex) return;

    const reordered = [...thumbnails];
    const [draggedItem] = reordered.splice(draggedPageIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    setThumbnails(reordered);
    setDraggedPageIndex(null);
  };

  const rotateSinglePage = (index, delta = 90) => {
    const updated = [...thumbnails];
    updated[index].rotation = (updated[index].rotation + delta + 360) % 360;
    setThumbnails(updated);
  };

  const rotateAllPages = (delta = 90) => {
    const updated = thumbnails.map((thumb) => ({
      ...thumb,
      rotation: (thumb.rotation + delta + 360) % 360
    }));
    setThumbnails(updated);
  };

  const deleteSinglePage = (index) => {
    if (thumbnails.length <= 1) {
      setErrorMsg('A PDF must contain at least one page.');
      return;
    }
    setThumbnails(thumbnails.filter((_, idx) => idx !== index));
  };

  const setToStringRange = (numSet) => {
    const sorted = Array.from(numSet).sort((a, b) => a - b);
    if (sorted.length === 0) return '';
    const ranges = [];
    let start = sorted[0];
    let end = start;

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) end = sorted[i];
      else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = start;
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(', ');
  };

  const togglePageSelection = (pageNum) => {
    const updated = new Set(selectedPages);
    if (updated.has(pageNum)) updated.delete(pageNum);
    else updated.add(pageNum);
    setSelectedPages(updated);
    setRangeInput(setToStringRange(updated));
  };

  const handleRangeInputChange = (e) => {
    const val = e.target.value;
    setRangeInput(val);
    const parts = val.split(',').map((p) => p.trim()).filter(Boolean);
    const newSet = new Set();

    parts.forEach((part) => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          const low = Math.max(1, Math.min(start, end));
          const high = Math.min(totalPages, Math.max(start, end));
          for (let i = low; i <= high; i++) newSet.add(i);
        }
      } else {
        const pNum = parseInt(part, 10);
        if (!isNaN(pNum) && pNum >= 1 && pNum <= totalPages) newSet.add(pNum);
      }
    });

    setSelectedPages(newSet);
  };

  const handleReconfigureSameFile = () => {
    if (result?.url) {
      URL.revokeObjectURL(result.url);
    }
    setResult(null);
    setErrorMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeAction = async () => {
    setErrorMsg('');

    if (tool?.id === 'merge' && files.length < 2) {
      setErrorMsg('Merge PDF requires at least 2 PDF files. Please click "+ Add More Files" to proceed.');
      return;
    }

    if (tool?.id === 'protect') {
      if (!protectPassword) {
        setErrorMsg('Please type a password to protect your PDF.');
        return;
      }
      if (protectPassword !== repeatPassword) {
        setErrorMsg('Passwords do not match. Please re-enter.');
        return;
      }
    }

    if (tool?.id === 'unlock' && unlockMode === 'with-password' && !unlockPassword) {
      setErrorMsg('Please enter the password to unlock this document.');
      return;
    }

    if (tool?.id === 'watermark' && watermarkOptions.type === 'image' && !watermarkOptions.imageFile) {
      setErrorMsg('Please select an image file to use as the watermark.');
      return;
    }

    setIsProcessing(true);

    try {
      let output;
      switch (tool?.id) {
        case 'ocr':
          output = await performPdfOcr(files[0], {
            language: ocrLanguage,
            outputMode: ocrOutputMode,
            onProgress: (prog) => setOcrProgress(prog)
          });
          break;
        case 'forms':
          output = await savePdfForms(files[0], formFields);
          break;
        case 'crop':
          output = await cropPDF(files[0], {
            pagesMode: cropPageMode,
            currentPage: cropCurrentPage,
            box: currentActiveBox,
            pageBoxes: pageCropBoxes
          });
          break;
        case 'protect':
          output = await protectPDF(files[0], protectPassword);
          break;
        case 'unlock':
          output = await unlockPDF(files[0], { mode: unlockMode, password: unlockPassword });
          break;
        case 'jpg-to-pdf':
          output = await imagesToPDF(imageCards, imageToPdfOptions);
          break;
        case 'watermark':
          output = await addWatermarkToPDF(files[0], watermarkOptions);
          break;
        case 'page-numbers':
          output = await addPageNumbersToPDF(files[0], pageNumberOptions);
          break;
        case 'pdf-to-excel':
          output = await convertPdfToExcel(files[0]);
          break;
        case 'pdf-to-powerpoint':
          output = await convertPdfToPowerpoint(files[0]);
          break;
        case 'rotate':
          output = await rotatePDF(files[0], thumbnails);
          break;
        case 'pdf-to-word':
          output = await convertPdfToWord(files[0]);
          break;
        case 'excel-to-pdf':
          output = await convertExcelToPDF(files[0]);
          break;
        case 'html-to-pdf':
          output = await convertHtmlToPDF(htmlInputMode === 'code' ? rawHtmlCode : files[0]);
          break;
        case 'powerpoint-to-pdf':
          output = await convertPowerpointToPDF(files[0]);
          break;
        case 'word-to-pdf':
          output = await convertWordToPDF(files[0]);
          break;
        case 'compress':
          output = await compressPDF(files[0], compressionPercent);
          break;
        case 'organize':
          output = await reorganizePDF(files[0], thumbnails);
          break;
        case 'merge':
          output = await mergePDFs(files);
          break;
        case 'remove':
          output = await removePagesFromPDF(files[0], selectedPages);
          break;
        case 'extract':
          output = await extractPagesFromPDF(files[0], selectedPages);
          break;
        case 'split':
          output = await splitPDF(files[0]);
          break;
        case 'pdf-to-jpg':
          output = await pdfToJpg(files[0]);
          break;
        case 'to-markdown':
          output = await pdfToMarkdown(files[0]);
          break;
        default:
          output = { blob: files[0], filename: `processed_${files[0]?.name || 'doc.pdf'}` };
      }

      const url = URL.createObjectURL(output.blob);
      setResult({
        url,
        filename: output.filename,
        originalSize: output.originalSize,
        compressedSize: output.compressedSize
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred during processing.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const k = 1024;
    if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
    return `${(bytes / (k * k)).toFixed(2)} MB`;
  };

  const getPositionDotClasses = (pos) => {
    const map = {
      'top-left': 'top-2.5 left-2.5',
      'top-center': 'top-2.5 left-1/2 -translate-x-1/2',
      'top-right': 'top-2.5 right-2.5',
      'middle-left': 'top-1/2 left-2.5 -translate-y-1/2',
      'middle-center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      'middle-right': 'top-1/2 right-2.5 -translate-y-1/2',
      'bottom-left': 'bottom-2.5 left-2.5',
      'bottom-center': 'bottom-2.5 left-1/2 -translate-x-1/2',
      'bottom-right': 'bottom-2.5 right-2.5'
    };
    return map[pos] || 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
  };

  const renderSingleFileThumbnailCard = (file) => {
    let IconComp = FileText;
    let badgeText = 'DOC';
    let badgeColor = 'bg-blue-600 text-white';
    let borderColor = 'border-blue-200';
    let bgGradient = 'from-blue-50/50 to-slate-50';

    if (tool?.id === 'powerpoint-to-pdf') {
      IconComp = Presentation;
      badgeText = 'PPT';
      badgeColor = 'bg-orange-600 text-white';
      borderColor = 'border-orange-200';
      bgGradient = 'from-orange-50/50 to-slate-50';
    } else if (tool?.id === 'excel-to-pdf') {
      IconComp = Sheet;
      badgeText = 'XLS';
      badgeColor = 'bg-emerald-600 text-white';
      borderColor = 'border-emerald-200';
      bgGradient = 'from-emerald-50/50 to-slate-50';
    } else if (tool?.id === 'html-to-pdf') {
      IconComp = FileCode;
      badgeText = 'HTML';
      badgeColor = 'bg-amber-600 text-white';
      borderColor = 'border-amber-200';
      bgGradient = 'from-amber-50/50 to-slate-50';
    } else if (tool?.id === 'to-markdown') {
      IconComp = FileText;
      badgeText = 'MD';
      badgeColor = 'bg-blue-600 text-white';
      borderColor = 'border-blue-200';
      bgGradient = 'from-blue-50/50 to-slate-50';
    }

    return (
      <div className={`relative mx-auto w-56 sm:w-64 rounded-2xl border-2 ${borderColor} bg-gradient-to-b ${bgGradient} p-5 shadow-sm text-center flex flex-col items-center justify-between space-y-4`}>
        <div className="absolute top-3 right-3">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${badgeColor}`}>
            {badgeText}
          </span>
        </div>

        <div className="w-20 h-28 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col items-center justify-center p-3 relative mt-2">
          <div className="w-full space-y-1.5 opacity-40">
            <div className="h-1.5 bg-slate-400 rounded-full w-3/4" />
            <div className="h-1.5 bg-slate-300 rounded-full w-full" />
            <div className="h-1.5 bg-slate-300 rounded-full w-5/6" />
            <div className="h-1.5 bg-slate-200 rounded-full w-1/2" />
          </div>
          <IconComp className="w-7 h-7 absolute inset-0 m-auto text-slate-700 opacity-90" />
        </div>

        <div className="w-full space-y-1">
          <p className="font-bold text-xs text-slate-800 truncate px-2" title={file.name}>
            {file.name}
          </p>
          <p className="text-[11px] font-medium text-slate-400">
            {formatFileSize(file.size)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => changeFileInputRef.current?.click()}
          className="text-[11px] font-bold text-rose-600 hover:text-rose-700 transition flex items-center space-x-1.5 bg-white hover:bg-rose-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Change Document</span>
        </button>
      </div>
    );
  };

  const renderFieldPropertiesContent = () => (
    <>
      {selectedField ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 capitalize">
              {selectedField.type === 'formtext' ? 'Static Text Annotation' : `${selectedField.type} Field Tool`}
            </h3>
            <button
              type="button"
              onClick={() => deleteSelectedField(selectedField.id)}
              className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700">
              {selectedField.type === 'formtext' ? 'Label Identifier:' : 'Field Name*:'}
            </label>
            <input
              type="text"
              value={selectedField.name || ''}
              onChange={(e) => updateSelectedField({ name: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {selectedField.type === 'formtext' ? (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">Text Content:</label>
              <input
                type="text"
                value={selectedField.value || ''}
                onChange={(e) => updateSelectedField({ value: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">Default Value:</label>
              <input
                type="text"
                value={selectedField.value || ''}
                onChange={(e) => updateSelectedField({ value: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          )}

          {(selectedField.type === 'combobox' || selectedField.type === 'listbox') && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700">Options</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {selectedField.options?.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...selectedField.options];
                        copy[optIdx] = e.target.value;
                        updateSelectedField({ options: copy });
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const copy = selectedField.options.filter((_, idx) => idx !== optIdx);
                        updateSelectedField({ options: copy });
                      }}
                      className="text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  updateSelectedField({
                    options: [...(selectedField.options || []), `Option ${selectedField.options.length + 1}`],
                  })
                }
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Option</span>
              </button>
            </div>
          )}

          {selectedField.type !== 'formtext' && (
            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <label className="font-bold text-slate-800 block mb-1">Properties</label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedField.readOnly || false}
                  onChange={(e) => updateSelectedField({ readOnly: e.target.checked })}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                <span className="text-slate-700">Read Only</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedField.required || false}
                  onChange={(e) => updateSelectedField({ required: e.target.checked })}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                <span className="text-slate-700">Required</span>
              </label>
              {selectedField.type === 'text' && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedField.multiline || false}
                    onChange={(e) => updateSelectedField({ multiline: e.target.checked })}
                    className="w-3.5 h-3.5 rounded accent-blue-600"
                  />
                  <span className="text-slate-700">Multiline</span>
                </label>
              )}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedField.includeIndicator || false}
                  onChange={(e) => updateSelectedField({ includeIndicator: e.target.checked })}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                <span className="text-slate-700">Include Field Indicator</span>
              </label>

              {selectedField.includeIndicator && (
                <div className="pl-6 pt-1">
                  <input
                    type="text"
                    placeholder="Sign Here"
                    value={selectedField.indicatorText || ''}
                    onChange={(e) => updateSelectedField({ indicatorText: e.target.value })}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
            <label className="font-bold text-slate-800 block">Field Size (% of page)</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5">Width (%)</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.5"
                  value={Number((selectedField.widthPercent || 20).toFixed(1))}
                  onChange={(e) => updateSelectedField({ widthPercent: Math.max(1, parseFloat(e.target.value) || 1) })}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-center text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5">Height (%)</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.5"
                  value={Number((selectedField.heightPercent || 3).toFixed(1))}
                  onChange={(e) => updateSelectedField({ heightPercent: Math.max(1, parseFloat(e.target.value) || 1) })}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-center text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
            <label className="font-bold text-slate-800 block">Text Formatting</label>
            <div className="flex items-center space-x-1.5">
              <select
                value={selectedField.fontFamily || 'Helvetica'}
                onChange={(e) => updateSelectedField({ fontFamily: e.target.value })}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg flex-1 text-xs"
              >
                <option value="Helvetica">Arial / Helvetica</option>
                <option value="Times">Times New Roman</option>
                <option value="Courier">Courier</option>
              </select>

              <select
                value={selectedField.fontSize || 11}
                onChange={(e) => updateSelectedField({ fontSize: parseInt(e.target.value, 10) })}
                className="w-12 px-1 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                {[9, 10, 11, 12, 14, 16, 18].map((sz) => (
                  <option key={sz} value={sz}>{sz}px</option>
                ))}
              </select>

              <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => updateSelectedField({ isBold: !selectedField.isBold })}
                  className={`px-1.5 py-0.5 font-bold text-xs rounded cursor-pointer ${selectedField.isBold ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedField({ isItalic: !selectedField.isItalic })}
                  className={`px-1.5 py-0.5 italic text-xs rounded cursor-pointer ${selectedField.isItalic ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedField({ isUnderline: !selectedField.isUnderline })}
                  className={`px-1.5 py-0.5 underline text-xs rounded cursor-pointer ${selectedField.isUnderline ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
                >
                  U
                </button>
              </div>
            </div>

            <div className="pt-1.5 flex items-center space-x-2">
              {['#000000', '#1E40AF', '#DC2626', '#16A34A', '#D97706', '#9333EA'].map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => updateSelectedField({ color: col })}
                  style={{ backgroundColor: col }}
                  className={`w-5 h-5 rounded-full border cursor-pointer transition ${
                    selectedField.color === col ? 'ring-2 ring-blue-500 scale-110 border-white' : 'border-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <h4 className="text-xs font-bold text-slate-800">
              {formFields.length === 0 ? 'This document has no form fields' : 'Form Field List'}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
              {formMode === 'edit'
                ? 'Tap anywhere on the PDF page to add inputs or tap an existing field to configure.'
                : 'Switch to Edit Form mode to add fields, or tap inputs to fill.'}
            </p>
          </div>
        </div>
      )}
    </>
  );

  const isFormsStudio = tool?.id === 'forms' && !result;

    // --- Edit PDF uses its own dedicated studio ---
  if (tool?.id === 'edit') {
    return (
      <EditPdfStudio
        tool={tool}
        file={files[0]}
        onBack={onBack}
      />
    );
  }

  return (
    <div className={`bg-slate-50 text-slate-800 ${isFormsStudio ? 'h-screen overflow-hidden flex flex-col' : 'min-h-screen pb-20'}`}>
      <input
        type="file"
        ref={changeFileInputRef}
        accept={getFileInputAccept()}
        className="hidden"
        onChange={handleReplaceDocument}
      />

      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-12 sm:h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 font-semibold text-xs sm:text-sm px-2.5 py-1 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${tool?.bg} ${tool?.color} flex items-center justify-center`}>
              {tool && <tool.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </div>
            <h2 className="text-xs sm:text-base font-bold text-slate-900 truncate max-w-[150px] sm:max-w-none">
              {tool?.name} Workspace
            </h2>
          </div>

          {isFormsStudio ? (
            <button
              onClick={executeAction}
              disabled={isProcessing}
              className="lg:hidden p-1.5 px-3 bg-red-600 text-white font-bold rounded-xl text-xs flex items-center space-x-1 shadow-sm"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Download className="w-3.5 h-3.5" /><span>Save</span></>}
            </button>
          ) : (
            <div className="w-16 sm:w-24" />
          )}
        </div>
      </header>

      <main className={`max-w-7xl mx-auto w-full px-2 sm:px-6 lg:px-8 ${isFormsStudio ? 'flex-1 overflow-hidden py-2 sm:py-3 flex flex-col' : 'pt-6'}`}>
        {errorMsg && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start space-x-2.5 shrink-0">
            <Info className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="flex-1 font-medium">{errorMsg}</p>
          </div>
        )}

        {!result ? (
          <div className={`${isFormsStudio ? 'flex-1 min-h-0 flex flex-col' : 'space-y-6'}`}>
            {/* OCR PDF Studio (Searchable PDF & Plain Text) */}
            {tool?.id === 'ocr' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto space-y-6 shadow-sm">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto shadow-xs">
                    <ScanText className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Make PDF Searchable (OCR)</h3>
                  <p className="text-xs text-slate-500">
                    Client-side WASM engine. Your files are processed locally and never uploaded to any server.
                  </p>
                </div>

                {files[0] && renderSingleFileThumbnailCard(files[0])}

                <div className="space-y-4 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1.5">Document Language</label>
                    <select
                      value={ocrLanguage}
                      onChange={(e) => setOcrLanguage(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="eng">English</option>
                      <option value="hin">Hindi (हिन्दी)</option>
                      <option value="spa">Spanish (Español)</option>
                      <option value="fra">French (Français)</option>
                      <option value="deu">German (Deutsch)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1.5">Output Format</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setOcrOutputMode('searchable_pdf')}
                        className={`p-3 rounded-xl border text-center transition cursor-pointer font-bold ${
                          ocrOutputMode === 'searchable_pdf'
                            ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        Searchable PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setOcrOutputMode('text')}
                        className={`p-3 rounded-xl border text-center transition cursor-pointer font-bold ${
                          ocrOutputMode === 'text'
                            ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        Extract Text (.txt)
                      </button>
                    </div>
                  </div>
                </div>

                {isProcessing && (
                  <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-teal-900">
                      <span>{ocrProgress.status || 'Scanning text...'}</span>
                      <span>{ocrProgress.percent}%</span>
                    </div>
                    <div className="w-full bg-teal-200/50 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={executeAction}
                  disabled={isProcessing}
                  className="w-full py-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Processing OCR In-Browser...</span>
                    </div>
                  ) : (
                    <>
                      <span>Start OCR Recognition</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* PDF Forms Studio */}
            {tool?.id === 'forms' && (
              <div className="flex-1 min-h-0 flex flex-col space-y-2 sm:space-y-3">
                <div className="bg-white border border-slate-200 rounded-2xl px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between gap-2 shadow-xs shrink-0 overflow-x-auto no-scrollbar">
                  <div className="flex items-center space-x-1.5 p-0.5 sm:p-1 bg-slate-100 rounded-xl shrink-0">
                    <button
                      type="button"
                      onClick={() => { setFormMode('fill'); setActiveFormTool(null); }}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-bold flex items-center space-x-1 transition cursor-pointer ${
                        formMode === 'fill' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Pen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>Fill Form</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFormMode('edit'); if (!activeFormTool) setActiveFormTool('text'); }}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-bold flex items-center space-x-1 transition cursor-pointer ${
                        formMode === 'edit' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sliders className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>Edit Form</span>
                    </button>
                  </div>

                  {formMode === 'edit' && (
                    <div className="flex items-center space-x-1 border-x border-slate-200 px-1.5 sm:px-2 overflow-x-auto shrink-0">
                      {[
                        { id: 'signature', label: 'Signature', icon: Pen },
                        { id: 'freetext', label: 'Interactive Text Field', icon: Type },
                        { id: 'formtext', label: 'Static Form Text', icon: AlignLeft, color: 'text-red-500' },
                        { id: 'checkbox', label: 'Checkbox', icon: SquareCheck },
                        { id: 'radio', label: 'Radio Button', icon: CircleDot },
                        { id: 'listbox', label: 'List Box', icon: ListOrdered },
                        { id: 'combobox', label: 'Combo Box', icon: ChevronDownIcon },
                      ].map((t) => {
                        const IconComp = t.icon;
                        const isActive = activeFormTool === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => { setActiveFormTool(t.id); }}
                            title={t.label}
                            className={`p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center shrink-0 ${
                              isActive ? 'bg-blue-50 border border-blue-500 text-blue-600 shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <IconComp className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${t.color || ''}`} />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="hidden sm:block text-xs font-semibold text-slate-500 truncate max-w-[160px]">
                    {files[0]?.name}
                  </div>
                </div>

                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch relative">
                  <div className="col-span-1 lg:col-span-8 bg-slate-100 rounded-2xl sm:rounded-3xl border border-slate-200 flex flex-col relative overflow-hidden h-full min-h-0 shadow-inner">
                    {isFormLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-slate-400">
                        <Loader2 className="w-8 h-8 sm:w-9 sm:h-9 animate-spin text-rose-500" />
                        <p className="text-xs font-semibold">Parsing Form Fields & Rendering...</p>
                      </div>
                    ) : formPageDataUrl ? (
                      <div className="flex-1 min-h-0 flex flex-col relative">
                        <div
                          ref={formViewportScrollRef}
                          className="flex-1 min-h-0 w-full overflow-auto p-2 sm:p-4"
                        >
                          <div
                            style={{
                              minWidth: '100%',
                              minHeight: '100%',
                              display: 'flex',
                              alignItems: isOverflowingY ? 'flex-start' : 'center',
                              justifyContent: isOverflowingX ? 'flex-start' : 'center',
                              padding: '8px',
                              boxSizing: 'border-box'
                            }}
                          >
                            <div
                              ref={formPageContainerRef}
                              onClick={handleCanvasClickToAddField}
                              style={{
                                width: `${displayWidth}px`,
                                height: `${displayHeight}px`,
                                position: 'relative',
                                flexShrink: 0,
                              }}
                              className={`bg-white shadow-2xl rounded-md transition-all duration-75 select-none overflow-hidden touch-none ${
                                formMode === 'edit' && activeFormTool ? 'cursor-crosshair' : 'cursor-default'
                              }`}
                            >
                              <img
                                src={formPageDataUrl}
                                alt={`Page ${formCurrentPage}`}
                                className="w-full h-full block pointer-events-none select-none form-page-img"
                                draggable={false}
                              />

                              {formFields
                                .filter((f) => f.page === formCurrentPage)
                                .map((field) => {
                                  const isSelected = selectedFieldId === field.id;
                                  const dynamicFontSize = Math.max(8, Math.round((field.fontSize || 11) * (displayWidth / pageW)));

                                  return (
                                    <div
                                      key={field.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedFieldId(field.id);
                                        if (window.innerWidth < 1024) {
                                          setIsMobileDrawerOpen(true);
                                        }
                                      }}
                                      onMouseDown={(e) => handleFieldPointerDown(e, field)}
                                      onTouchStart={(e) => handleFieldPointerDown(e, field)}
                                      style={{
                                        left: `${field.xPercent}%`,
                                        top: `${field.yPercent}%`,
                                        width: `${field.widthPercent}%`,
                                        height: `${field.heightPercent}%`,
                                      }}
                                      className={`group absolute flex items-center justify-center transition-all ${
                                        field.type === 'formtext'
                                          ? isSelected
                                            ? 'border border-dashed border-red-500 bg-red-50/20'
                                            : 'border border-transparent hover:border-red-300'
                                          : isSelected
                                          ? 'border-2 border-blue-500 bg-blue-50/50 shadow-md z-30'
                                          : 'border border-blue-300/80 bg-blue-50/20 hover:border-blue-400 z-20'
                                      } ${formMode === 'edit' ? 'cursor-move' : 'cursor-pointer'}`}
                                    >
                                      {field.includeIndicator && (
                                        <div
                                          className="absolute right-full mr-2 flex items-center pointer-events-none z-40 select-none drop-shadow-sm"
                                          style={{ top: '50%', transform: 'translateY(-50%)' }}
                                        >
                                          <div className="px-1.5 py-0.5 bg-sky-500 text-white font-bold rounded-l-md text-[9px] whitespace-nowrap shadow-xs">
                                            {field.indicatorText || 'Sign Here'}
                                          </div>
                                          <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[5px] border-l-sky-500" />
                                        </div>
                                      )}

                                      <div
                                        onMouseDown={(e) => handleFieldPointerDown(e, field, null, true)}
                                        onTouchStart={(e) => handleFieldPointerDown(e, field, null, true)}
                                        className={`absolute -top-2.5 -right-2.5 p-1 bg-blue-600 text-white rounded-full shadow cursor-grab active:cursor-grabbing z-40 transition-opacity ${
                                          isSelected || formMode === 'edit' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                        title="Drag to reposition"
                                      >
                                        <Move className="w-2.5 h-2.5" />
                                      </div>

                                      {field.type === 'formtext' ? (
                                        <div
                                          style={{
                                            color: field.color || '#DC2626',
                                            fontSize: `${dynamicFontSize}px`,
                                            fontFamily: field.fontFamily || 'Helvetica',
                                            fontWeight: field.isBold ? 'bold' : 'normal',
                                            fontStyle: field.isItalic ? 'italic' : 'normal',
                                            textDecoration: field.isUnderline ? 'underline' : 'none',
                                          }}
                                          className="w-full h-full px-1 flex items-center truncate select-none pointer-events-none"
                                        >
                                          {field.value || 'Insert text here'}
                                        </div>
                                      ) : field.type === 'checkbox' ? (
                                        <input
                                          type="checkbox"
                                          checked={Boolean(field.value)}
                                          disabled={field.readOnly}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            updateSelectedField({ value: e.target.checked });
                                            setSelectedFieldId(field.id);
                                          }}
                                          className="w-4 h-4 accent-blue-600 cursor-pointer pointer-events-auto"
                                        />
                                      ) : field.type === 'radio' ? (
                                        <input
                                          type="radio"
                                          checked={Boolean(field.value)}
                                          disabled={field.readOnly}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            updateSelectedField({ value: e.target.checked });
                                            setSelectedFieldId(field.id);
                                          }}
                                          className="w-4 h-4 accent-blue-600 cursor-pointer pointer-events-auto"
                                        />
                                      ) : field.type === 'signature' ? (
                                        <div
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedFieldId(field.id);
                                            if (window.innerWidth < 1024) setIsMobileDrawerOpen(true);
                                          }}
                                          style={{ fontSize: `${dynamicFontSize}px` }}
                                          className="w-full h-full px-2 flex items-center font-serif italic text-blue-900 truncate cursor-pointer pointer-events-auto"
                                        >
                                          {field.value || (
                                            <span className="px-1.5 py-0.5 bg-blue-900 text-white rounded font-sans not-italic text-[10px] font-bold">
                                              Sign here
                                            </span>
                                          )}
                                        </div>
                                      ) : field.type === 'combobox' ? (
                                        <select
                                          value={field.value}
                                          disabled={field.readOnly}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedFieldId(field.id);
                                          }}
                                          onChange={(e) => updateSelectedField({ value: e.target.value })}
                                          style={{ fontSize: `${dynamicFontSize}px` }}
                                          className="w-full h-full px-1 bg-transparent focus:outline-none pointer-events-auto cursor-pointer"
                                        >
                                          {field.options?.map((opt, i) => (
                                            <option key={i} value={opt}>
                                              {opt}
                                            </option>
                                          ))}
                                        </select>
                                      ) : field.type === 'listbox' ? (
                                        <div
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedFieldId(field.id);
                                          }}
                                          style={{ fontSize: `${Math.max(8, dynamicFontSize - 1)}px` }}
                                          className="w-full h-full overflow-y-auto p-1 bg-white/70 pointer-events-auto"
                                        >
                                          {field.options?.map((opt, i) => (
                                            <div
                                              key={i}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateSelectedField({ value: opt });
                                              }}
                                              className={`px-1 rounded cursor-pointer ${field.value === opt ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
                                            >
                                              {opt}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <input
                                          type="text"
                                          value={field.value || ''}
                                          placeholder={formMode === 'edit' ? field.name : 'Type here...'}
                                          disabled={field.readOnly}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedFieldId(field.id);
                                          }}
                                          onFocus={(e) => {
                                            e.stopPropagation();
                                            setSelectedFieldId(field.id);
                                          }}
                                          onChange={(e) => updateSelectedField({ value: e.target.value })}
                                          style={{
                                            color: field.color || '#000000',
                                            fontSize: `${dynamicFontSize}px`,
                                            fontFamily: field.fontFamily || 'Helvetica',
                                            fontWeight: field.isBold ? 'bold' : 'normal',
                                            fontStyle: field.isItalic ? 'italic' : 'normal',
                                            textDecoration: field.isUnderline ? 'underline' : 'none',
                                          }}
                                          className="w-full h-full px-1.5 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm pointer-events-auto cursor-text select-text"
                                        />
                                      )}

                                      {isSelected && (
                                        <>
                                          {['nw', 'ne', 'sw', 'se'].map((h) => {
                                            const pos = {
                                              nw: '-top-1.5 -left-1.5 cursor-nwse-resize',
                                              ne: '-top-1.5 -right-1.5 cursor-nesw-resize',
                                              sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
                                              se: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
                                            }[h];
                                            return (
                                              <div
                                                key={h}
                                                onMouseDown={(e) => handleFieldPointerDown(e, field, h)}
                                                onTouchStart={(e) => handleFieldPointerDown(e, field, h)}
                                                className={`absolute w-3 h-3 bg-white border-2 border-blue-600 rounded-xs shadow-xs z-40 ${pos}`}
                                              />
                                            );
                                          })}
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </div>

                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl flex items-center space-x-1.5 sm:space-x-2 text-[11px] sm:text-xs shadow-xl z-30 max-w-[95vw]">
                          <button
                            type="button"
                            onClick={() => setFormCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={formCurrentPage <= 1}
                            className="p-1 hover:bg-slate-700 rounded-lg disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormCurrentPage((p) => Math.min(formTotalPages, p + 1))}
                            disabled={formCurrentPage >= formTotalPages}
                            className="p-1 hover:bg-slate-700 rounded-lg disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <div className="h-3.5 w-px bg-slate-700" />
                          <span className="font-bold px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">
                            {formCurrentPage}
                          </span>
                          <span className="text-slate-400">/ {formTotalPages}</span>
                          <div className="h-3.5 w-px bg-slate-700" />
                          <button
                            type="button"
                            onClick={() => setFormZoom((z) => Math.max(50, z - 15))}
                            className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer"
                          >
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormZoom((z) => Math.min(300, z + 15))}
                            className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono text-slate-300 font-semibold">{formZoom}%</span>
                          <div className="h-3.5 w-px bg-slate-700" />
                          <button
                            type="button"
                            onClick={() => setFormZoom(100)}
                            title="Fit page to screen"
                            className="p-1 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white cursor-pointer"
                          >
                            <Maximize className="w-3.5 h-3.5" />
                          </button>

                          {selectedField && (
                            <>
                              <div className="h-3.5 w-px bg-slate-700 lg:hidden" />
                              <button
                                type="button"
                                onClick={() => setIsMobileDrawerOpen(true)}
                                className="lg:hidden px-2 py-0.5 bg-blue-600 text-white rounded-lg font-bold flex items-center space-x-1"
                              >
                                <SlidersVertical className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Desktop Right Sidebar */}
                  <div className="hidden lg:flex lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm h-full min-h-0 flex-col justify-between">
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                      {renderFieldPropertiesContent()}
                    </div>

                    <button
                      onClick={executeAction}
                      disabled={isProcessing}
                      className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 transition flex items-center justify-center space-x-2 cursor-pointer mt-3 shrink-0"
                    >
                      {isProcessing ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span className="text-xs">Generating Filled PDF...</span>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-black tracking-wide">Download</span>
                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                            <ArrowRight className="w-3.5 h-3.5 text-white" />
                          </div>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Mobile Slide-Up Drawer / Bottom Sheet */}
                  {isMobileDrawerOpen && (
                    <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150">
                      <div className="bg-white rounded-t-3xl p-4 shadow-2xl border-t border-slate-200 max-h-[75vh] flex flex-col space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto" />
                          <button
                            type="button"
                            onClick={() => setIsMobileDrawerOpen(false)}
                            className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <CloseIcon className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1">
                          {renderFieldPropertiesContent()}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsMobileDrawerOpen(false)}
                          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-sm"
                        >
                          Done Editing
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 0. Crop PDF Studio */}
            {tool?.id === 'crop' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-8 bg-slate-200/60 rounded-3xl p-3 sm:p-6 border border-slate-200 flex flex-col items-center min-h-[420px] sm:min-h-[580px] relative overflow-hidden">
                  {isRenderingPages ? (
                    <div className="py-32 sm:py-44 flex flex-col items-center justify-center space-y-3 text-slate-400">
                      <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
                      <p className="text-xs font-semibold">Rendering page for cropping...</p>
                    </div>
                  ) : cropPageDataUrl ? (
                    <div className="w-full flex flex-col items-center justify-center">
                      <div
                        ref={cropCanvasContainerRef}
                        style={{ width: `${Math.min(100, Math.max(cropZoom, 80))}%` }}
                        className="relative bg-white shadow-xl rounded-md transition-all duration-150 select-none overflow-hidden touch-none"
                      >
                        <img
                          src={cropPageDataUrl}
                          alt={`Page ${cropCurrentPage}`}
                          className="w-full h-auto pointer-events-none block select-none"
                          draggable={false}
                        />

                        <div className="absolute top-0 left-0 right-0 bg-slate-900/40 pointer-events-none" style={{ height: `${currentActiveBox.y}%` }} />
                        <div className="absolute bottom-0 left-0 right-0 bg-slate-900/40 pointer-events-none" style={{ height: `${100 - (currentActiveBox.y + currentActiveBox.height)}%` }} />
                        <div className="absolute left-0 bg-slate-900/40 pointer-events-none" style={{ top: `${currentActiveBox.y}%`, height: `${currentActiveBox.height}%`, width: `${currentActiveBox.x}%` }} />
                        <div className="absolute right-0 bg-slate-900/40 pointer-events-none" style={{ top: `${currentActiveBox.y}%`, height: `${currentActiveBox.height}%`, width: `${100 - (currentActiveBox.x + currentActiveBox.width)}%` }} />

                        <div
                          onMouseDown={(e) => handleCropPointerDown(e)}
                          onTouchStart={(e) => handleCropPointerDown(e)}
                          style={{
                            left: `${currentActiveBox.x}%`,
                            top: `${currentActiveBox.y}%`,
                            width: `${currentActiveBox.width}%`,
                            height: `${currentActiveBox.height}%`
                          }}
                          className="absolute border-2 border-dashed border-rose-500 cursor-move z-20 group shadow-[0_0_0_9999px_rgba(0,0,0,0.3)] touch-none"
                        >
                          {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map((handle) => {
                            const posClasses = {
                              nw: '-top-2.5 -left-2.5 cursor-nwse-resize',
                              ne: '-top-2.5 -right-2.5 cursor-nesw-resize',
                              sw: '-bottom-2.5 -left-2.5 cursor-nesw-resize',
                              se: '-bottom-2.5 -right-2.5 cursor-nwse-resize',
                              n: '-top-2.5 left-1/2 -translate-x-1/2 cursor-ns-resize',
                              s: '-bottom-2.5 left-1/2 -translate-x-1/2 cursor-ns-resize',
                              e: 'top-1/2 -right-2.5 -translate-y-1/2 cursor-ew-resize',
                              w: 'top-1/2 -left-2.5 -translate-y-1/2 cursor-ew-resize',
                            };
                            return (
                              <div
                                key={handle}
                                onMouseDown={(e) => handleCropPointerDown(e, handle)}
                                onTouchStart={(e) => handleCropPointerDown(e, handle)}
                                className={`absolute w-5 h-5 sm:w-3.5 sm:h-3.5 bg-white border-2 border-rose-500 rounded-sm shadow-md touch-none z-30 ${posClasses[handle]}`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-5 sm:mt-8 bg-slate-800/90 backdrop-blur-md text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl flex items-center space-x-2 sm:space-x-3 text-xs shadow-lg max-w-full overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setCropCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={cropCurrentPage <= 1}
                          className="p-1 hover:bg-slate-700 rounded-lg disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCropCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={cropCurrentPage >= totalPages}
                          className="p-1 hover:bg-slate-700 rounded-lg disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <div className="h-4 w-px bg-slate-600" />
                        <span className="font-bold px-1.5 py-0.5 bg-slate-700 rounded text-slate-200">
                          {cropCurrentPage}
                        </span>
                        <span className="text-slate-400">/ {totalPages}</span>
                        <div className="h-4 w-px bg-slate-600" />
                        <button
                          type="button"
                          onClick={() => setCropZoom((z) => Math.max(50, z - 10))}
                          className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCropZoom((z) => Math.min(100, z + 10))}
                          className="p-1 hover:bg-slate-700 rounded-lg cursor-pointer"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-slate-300 font-semibold">{cropZoom}%</span>
                        <div className="h-4 w-px bg-slate-600" />
                        <button
                          type="button"
                          onClick={() => setCropZoom(85)}
                          className="p-1 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white cursor-pointer"
                        >
                          <Maximize className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Crop PDF</h3>
                      {cropPageMode === 'custom' && (
                        <span className="text-xs font-semibold text-slate-500">
                          {Object.keys(pageCropBoxes).length} of {totalPages} pages modified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {isCurrentPageCropped && cropPageMode === 'custom' && (
                        <button
                          type="button"
                          onClick={resetCurrentPageCrop}
                          className="text-xs font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
                        >
                          Reset Page {cropCurrentPage}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPageCropBoxes({})}
                        className="text-xs font-bold text-red-500 hover:text-red-700 underline cursor-pointer"
                      >
                        Reset all
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-sky-50 border border-sky-200/80 rounded-2xl flex items-start space-x-3 text-xs text-sky-900 leading-relaxed">
                    <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <p className="font-medium">
                      Click and drag to select the area you want to keep. Resize if needed.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="text-sm font-bold text-slate-900 block">Apply crop to:</label>
                    <div className="flex flex-col space-y-2">
                      <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="radio"
                          name="cropPageSelection"
                          checked={cropPageMode === 'custom'}
                          onChange={() => setCropPageMode('custom')}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer"
                        />
                        <span>Custom per page (Only cropped pages will be modified)</span>
                      </label>

                      <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="radio"
                          name="cropPageSelection"
                          checked={cropPageMode === 'all'}
                          onChange={() => {
                            setCropPageMode('all');
                            const updatedAll = {};
                            for (let i = 1; i <= totalPages; i++) {
                              updatedAll[i] = { ...currentActiveBox };
                            }
                            setPageCropBoxes(updatedAll);
                          }}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer"
                        />
                        <span>Same crop across all pages</span>
                      </label>

                      <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="radio"
                          name="cropPageSelection"
                          checked={cropPageMode === 'current'}
                          onChange={() => setCropPageMode('current')}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer"
                        />
                        <span>Crop only Page {cropCurrentPage}</span>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={executeAction}
                    disabled={isProcessing}
                    className="w-full py-4 bg-rose-400 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer mt-8"
                  >
                    {isProcessing ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                        <span>Cropping PDF document...</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-lg">Crop PDF</span>
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                          <ArrowRight className="w-4 h-4 text-white" />
                        </div>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 1. Protect PDF Studio */}
            {tool?.id === 'protect' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[420px]">
                  <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-semibold mb-6">
                    <span className="text-slate-600">{files[0]?.name} ({totalPages} Pages)</span>
                    <button
                      type="button"
                      onClick={() => changeFileInputRef.current?.click()}
                      className="text-rose-600 hover:text-rose-700 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Change File</span>
                    </button>
                  </div>

                  {thumbnails[0] ? (
                    <div className="relative rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 shadow-sm text-center">
                      <img src={thumbnails[0].dataUrl} alt="Cover Preview" className="max-h-72 object-contain rounded-lg shadow-sm" />
                      <div className="mt-2 text-xs font-bold text-slate-700">{files[0]?.name}</div>
                    </div>
                  ) : (
                    <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
                  )}
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm text-xs">
                  <h3 className="font-bold text-slate-900 text-base border-b pb-3">Protect PDF</h3>
                  <p className="text-slate-500 font-medium">Set a password to protect your PDF file</p>

                  <div className="space-y-3">
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Type password"
                        value={protectPassword}
                        onChange={(e) => setProtectPassword(e.target.value)}
                        className="w-full pl-9 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 bottom-0 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-r-xl flex items-center justify-center cursor-pointer transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3" />
                      <input
                        type={showRepeatPassword ? 'text' : 'password'}
                        placeholder="Repeat password"
                        value={repeatPassword}
                        onChange={(e) => setRepeatPassword(e.target.value)}
                        className="w-full pl-9 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                        className="absolute right-0 top-0 bottom-0 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-r-xl flex items-center justify-center cursor-pointer transition"
                      >
                        {showRepeatPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={executeAction}
                    disabled={isProcessing || !protectPassword || !repeatPassword}
                    className="w-full py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer mt-4"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Protect PDF</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Unlock PDF Studio */}
            {tool?.id === 'unlock' && (
              <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-sm">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                    <Unlock className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Unlock PDF Document</h3>
                  <p className="text-xs text-slate-500">
                    Target Document: <strong className="text-slate-700">{files[0]?.name}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => { setUnlockMode('without-password'); setErrorMsg(''); }}
                    className={`py-3 rounded-xl flex items-center justify-center space-x-2 transition cursor-pointer ${
                      unlockMode === 'without-password' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Wand2 className="w-4 h-4 text-purple-600" />
                    <span>Automatic Unlock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setUnlockMode('with-password'); setErrorMsg(''); }}
                    className={`py-3 rounded-xl flex items-center justify-center space-x-2 transition cursor-pointer ${
                      unlockMode === 'with-password' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>I have password</span>
                  </button>
                </div>

                {unlockMode === 'without-password' ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start space-x-2.5 text-xs text-amber-950">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-900">Under Development Notice</p>
                        <p className="mt-0.5 text-amber-800 leading-relaxed">
                          Automatic password stripping removes permissions and tests standard keys, but cannot bypass high-entropy user open passwords.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl text-xs text-purple-950 space-y-1">
                      <p className="font-bold text-purple-900">Target Operations:</p>
                      <p className="text-slate-600 leading-relaxed">
                        Removes owner restrictions (printing, editing, copying) and common default encryption keys automatically.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    <p className="text-slate-600">Enter the user password to permanently decrypt and unprotect this document.</p>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3" />
                      <input
                        type={showUnlockPassword ? 'text' : 'password'}
                        placeholder="Enter PDF password"
                        value={unlockPassword}
                        onChange={(e) => setUnlockPassword(e.target.value)}
                        className="w-full pl-9 pr-12 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                        className="absolute right-0 top-0 bottom-0 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-r-2xl flex items-center justify-center cursor-pointer transition"
                      >
                        {showUnlockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={executeAction}
                  disabled={isProcessing || (unlockMode === 'with-password' && !unlockPassword)}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>{unlockMode === 'without-password' ? 'Analyzing and stripping restrictions...' : 'Decrypting document...'}</span>
                    </div>
                  ) : (
                    <span>{unlockMode === 'without-password' ? 'Unlock Document' : 'Decrypt & Unlock PDF'}</span>
                  )}
                </button>
              </div>
            )}

            {/* 3. Image to PDF Studio */}
            {tool?.id === 'jpg-to-pdf' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-semibold">
                    <span className="text-slate-600">{imageCards.length} {imageCards.length === 1 ? 'Image' : 'Images'} Selected</span>
                    <label htmlFor="studioAddImagesInput" className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add More Images</span>
                      <input
                        type="file"
                        id="studioAddImagesInput"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleAddMoreImages}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[560px] overflow-y-auto pr-1">
                    {imageCards.map((card, idx) => {
                      const isLandscape = imageToPdfOptions.orientation === 'landscape';
                      const marginPadding =
                        imageToPdfOptions.margin === 'small' ? 'p-3' : imageToPdfOptions.margin === 'big' ? 'p-5' : 'p-0';

                      return (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={(e) => handleImageDragStart(e, idx)}
                          onDragOver={handleImageDragOver}
                          onDrop={(e) => handleImageDrop(e, idx)}
                          className={`group relative rounded-2xl border-2 overflow-hidden bg-slate-50 flex flex-col items-center justify-center p-2 shadow-xs cursor-grab active:cursor-grabbing transition ${
                            draggedImageIndex === idx ? 'opacity-40 border-rose-400' : 'border-slate-200 hover:border-rose-300'
                          }`}
                        >
                          <div
                            className={`w-full bg-white border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden transition-all shadow-xs ${marginPadding} ${
                              isLandscape ? 'aspect-4/3' : 'aspect-3/4'
                            }`}
                          >
                            <img
                              src={card.previewUrl}
                              alt={card.file.name}
                              style={{ transform: `rotate(${card.rotation}deg)` }}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>

                          <div className="absolute top-3 right-3 flex space-x-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={() => rotateImageCard(idx)}
                              className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-rose-600 cursor-pointer"
                              title="Rotate"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteImageCard(idx)}
                              className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-red-600 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="w-full px-2 pt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span className="truncate max-w-[100px]">{card.file.name}</span>
                            <span>Page {idx + 1}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm text-xs">
                  <h3 className="font-bold text-slate-900 text-sm border-b pb-3">Image to PDF options</h3>

                  <div className="space-y-2">
                    <label className="font-semibold text-slate-700 block">Page orientation</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setImageToPdfOptions({ ...imageToPdfOptions, orientation: 'portrait' })}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer ${
                          imageToPdfOptions.orientation === 'portrait'
                            ? 'border-rose-500 bg-rose-50/50 text-rose-700 font-bold ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <RectangleVertical className="w-5 h-5 text-rose-600" />
                        <span>Portrait</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImageToPdfOptions({ ...imageToPdfOptions, orientation: 'landscape' })}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer ${
                          imageToPdfOptions.orientation === 'landscape'
                            ? 'border-rose-500 bg-rose-50/50 text-rose-700 font-bold ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <RectangleHorizontal className="w-5 h-5 text-rose-600" />
                        <span>Landscape</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block">Page size</label>
                    <select
                      value={imageToPdfOptions.pageSize}
                      onChange={(e) => setImageToPdfOptions({ ...imageToPdfOptions, pageSize: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                    >
                      <option value="a4">A4 (297x210 mm)</option>
                      <option value="fit">Fit (Same page size as image)</option>
                      <option value="letter">US Letter (215.9x279.4 mm)</option>
                    </select>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block">Margin</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setImageToPdfOptions({ ...imageToPdfOptions, margin: 'none' })}
                        className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                          imageToPdfOptions.margin === 'none'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <Square className="w-4 h-4 text-rose-600" />
                        <span className="text-[11px]">No margin</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImageToPdfOptions({ ...imageToPdfOptions, margin: 'small' })}
                        className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                          imageToPdfOptions.margin === 'small'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <SlidersHorizontal className="w-4 h-4 text-rose-600" />
                        <span className="text-[11px]">Small</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImageToPdfOptions({ ...imageToPdfOptions, margin: 'big' })}
                        className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                          imageToPdfOptions.margin === 'big'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <Maximize2 className="w-4 h-4 text-rose-600" />
                        <span className="text-[11px]">Big</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={imageToPdfOptions.mergeAll}
                        onChange={(e) => setImageToPdfOptions({ ...imageToPdfOptions, mergeAll: e.target.checked })}
                        className="w-4 h-4 rounded accent-rose-600"
                      />
                      <span className="font-semibold text-slate-800">Merge all images in one PDF file</span>
                    </label>
                  </div>

                  <button
                    onClick={executeAction}
                    disabled={isProcessing || imageCards.length === 0}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Convert to PDF</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* 4. Watermark Studio */}
            {tool?.id === 'watermark' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-semibold">
                    <span className="text-slate-600">{files[0]?.name} ({totalPages} Pages)</span>
                    <button
                      type="button"
                      onClick={() => changeFileInputRef.current?.click()}
                      className="text-rose-600 hover:text-rose-700 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Change File</span>
                    </button>
                  </div>

                  {isRenderingPages ? (
                    <div className="py-32 text-center text-slate-400 space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-fuchsia-500" />
                      <p className="text-sm">Rendering document preview...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 max-h-[560px] overflow-y-auto pr-1">
                      {thumbnails.map((thumb, idx) => {
                        const inRange =
                          thumb.pageNumber >= watermarkOptions.fromPage &&
                          thumb.pageNumber <= watermarkOptions.toPage;
                        return (
                          <div
                            key={thumb.id}
                            className="relative rounded-2xl border-2 border-slate-200 bg-slate-50 shadow-xs overflow-hidden p-3 flex flex-col items-center justify-center min-h-[200px]"
                          >
                            <img src={thumb.dataUrl} alt={`Page ${idx + 1}`} className="max-h-44 object-contain shadow-sm bg-white" />
                            {inRange && !watermarkOptions.isMosaic && (
                              <div
                                className={`absolute w-4 h-4 bg-rose-500 rounded-full shadow-md border-2 border-white transition-all duration-150 ${getPositionDotClasses(
                                  watermarkOptions.position
                                )}`}
                              />
                            )}
                            {inRange && watermarkOptions.isMosaic && (
                              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-4 pointer-events-none">
                                {[...Array(9)].map((_, dotIdx) => (
                                  <div key={dotIdx} className="flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 bg-rose-500/80 rounded-full border border-white" />
                                  </div>
                                ))}
                              </div>
                            )}
                            <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800/80 text-white">
                              {idx + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm text-xs">
                  <h3 className="font-bold text-slate-900 text-sm border-b pb-3">Watermark options</h3>

                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setWatermarkOptions({ ...watermarkOptions, type: 'text' })}
                      className={`py-2 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                        watermarkOptions.type === 'text' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Type className="w-4 h-4 text-rose-500" />
                      <span>Place text</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWatermarkOptions({ ...watermarkOptions, type: 'image' })}
                      className={`py-2 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                        watermarkOptions.type === 'image' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4 text-rose-500" />
                      <span>Place image</span>
                    </button>
                  </div>

                  {watermarkOptions.type === 'text' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Text:</label>
                        <input
                          type="text"
                          value={watermarkOptions.text}
                          onChange={(e) => setWatermarkOptions({ ...watermarkOptions, text: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 block text-[11px]">Text format:</label>
                        <div className="flex items-center space-x-2">
                          <select
                            value={watermarkOptions.fontFamily}
                            onChange={(e) => setWatermarkOptions({ ...watermarkOptions, fontFamily: e.target.value })}
                            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex-1"
                          >
                            <option value="Helvetica">Arial / Helvetica</option>
                            <option value="Times">Times New Roman</option>
                            <option value="Courier">Courier</option>
                          </select>

                          <div className="flex items-center space-x-0.5 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => setWatermarkOptions({ ...watermarkOptions, isBold: !watermarkOptions.isBold })}
                              className={`px-2 py-1 font-bold rounded cursor-pointer ${watermarkOptions.isBold ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => setWatermarkOptions({ ...watermarkOptions, isItalic: !watermarkOptions.isItalic })}
                              className={`px-2 py-1 italic rounded cursor-pointer ${watermarkOptions.isItalic ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => setWatermarkOptions({ ...watermarkOptions, isUnderline: !watermarkOptions.isUnderline })}
                              className={`px-2 py-1 underline rounded cursor-pointer ${watermarkOptions.isUnderline ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                            >
                              U
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Image:</label>
                      <label className="flex items-center justify-center space-x-2 p-3 bg-rose-50 hover:bg-rose-100 border-2 border-dashed border-rose-300 text-rose-700 font-bold rounded-2xl cursor-pointer transition">
                        <ImageIcon className="w-4 h-4" />
                        <span>{watermarkOptions.imageFile ? watermarkOptions.imageFile.name : 'ADD IMAGE'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={handleWatermarkImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block">Position:</label>
                    <div className="flex items-center space-x-4">
                      <div className="grid grid-cols-3 gap-1 w-20 h-20 border border-slate-300 rounded-xl p-1 bg-slate-50">
                        {[
                          'top-left', 'top-center', 'top-right',
                          'middle-left', 'middle-center', 'middle-right',
                          'bottom-left', 'bottom-center', 'bottom-right'
                        ].map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            disabled={watermarkOptions.isMosaic}
                            onClick={() => setWatermarkOptions({ ...watermarkOptions, position: pos })}
                            className={`rounded-md transition-colors flex items-center justify-center cursor-pointer ${
                              watermarkOptions.position === pos && !watermarkOptions.isMosaic
                                ? 'bg-rose-500 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${watermarkOptions.position === pos && !watermarkOptions.isMosaic ? 'bg-white' : 'bg-slate-400'}`} />
                          </button>
                        ))}
                      </div>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={watermarkOptions.isMosaic}
                          onChange={(e) => setWatermarkOptions({ ...watermarkOptions, isMosaic: e.target.checked })}
                          className="w-4 h-4 rounded accent-rose-500"
                        />
                        <span className="font-bold text-slate-700">Mosaic</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Transparency:</label>
                      <select
                        value={watermarkOptions.opacity}
                        onChange={(e) => setWatermarkOptions({ ...watermarkOptions, opacity: parseFloat(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value="1.0">No transparency</option>
                        <option value="0.75">25% (Light)</option>
                        <option value="0.5">50% (Recommended)</option>
                        <option value="0.25">75% (Faint)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Rotation:</label>
                      <select
                        value={watermarkOptions.rotation}
                        onChange={(e) => setWatermarkOptions({ ...watermarkOptions, rotation: parseInt(e.target.value, 10) })}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value="0">Do not rotate</option>
                        <option value="45">45 Degrees</option>
                        <option value="90">90 Degrees</option>
                        <option value="180">180 Degrees</option>
                        <option value="270">270 Degrees</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block mb-1">Pages:</label>
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500">from page</span>
                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={watermarkOptions.fromPage}
                        onChange={(e) => setWatermarkOptions({ ...watermarkOptions, fromPage: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        className="w-14 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-medium"
                      />
                      <span className="text-slate-500">to</span>
                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={watermarkOptions.toPage}
                        onChange={(e) => setWatermarkOptions({ ...watermarkOptions, toPage: Math.min(totalPages, parseInt(e.target.value, 10) || totalPages) })}
                        className="w-14 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-medium"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <label className="font-semibold text-slate-700 block">Layer:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWatermarkOptions({ ...watermarkOptions, layer: 'over' })}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          watermarkOptions.layer === 'over'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        Over the PDF content
                      </button>
                      <button
                        type="button"
                        onClick={() => setWatermarkOptions({ ...watermarkOptions, layer: 'below' })}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          watermarkOptions.layer === 'below'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        Below the PDF content
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={executeAction}
                    disabled={isProcessing || isRenderingPages}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Add watermark</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* 5. Page Numbers Studio */}
            {tool?.id === 'page-numbers' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-semibold">
                    <span className="text-slate-600">{files[0]?.name} ({totalPages} Pages)</span>
                    <button
                      type="button"
                      onClick={() => changeFileInputRef.current?.click()}
                      className="text-rose-600 hover:text-rose-700 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Change File</span>
                    </button>
                  </div>

                  {isRenderingPages ? (
                    <div className="py-32 text-center text-slate-400 space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
                      <p className="text-sm">Rendering document preview...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 max-h-[560px] overflow-y-auto pr-1">
                      {thumbnails.map((thumb, idx) => {
                        const inRange =
                          thumb.pageNumber >= pageNumberOptions.fromPage &&
                          thumb.pageNumber <= pageNumberOptions.toPage;
                        return (
                          <div
                            key={thumb.id}
                            className="relative rounded-2xl border-2 border-slate-200 bg-slate-50 shadow-xs overflow-hidden p-3 flex flex-col items-center justify-center min-h-[200px]"
                          >
                            <img src={thumb.dataUrl} alt={`Page ${idx + 1}`} className="max-h-44 object-contain shadow-sm bg-white" />
                            {inRange && (
                              <div
                                className={`absolute w-4 h-4 bg-rose-500 rounded-full shadow-md border-2 border-white transition-all duration-150 ${getPositionDotClasses(
                                  pageNumberOptions.position
                                )}`}
                              />
                            )}
                            <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800/80 text-white">
                              {idx + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm text-xs">
                  <h3 className="font-bold text-slate-900 text-sm border-b pb-3">Page Number options</h3>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-2">Page mode</label>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="pageMode"
                          checked={pageNumberOptions.pageMode === 'single'}
                          onChange={() => setPageNumberOptions({ ...pageNumberOptions, pageMode: 'single' })}
                          className="accent-rose-500"
                        />
                        <span className="text-slate-700 font-medium">Single page</span>
                      </label>
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="pageMode"
                          checked={pageNumberOptions.pageMode === 'facing'}
                          onChange={() => setPageNumberOptions({ ...pageNumberOptions, pageMode: 'facing' })}
                          className="accent-rose-500"
                        />
                        <span className="text-slate-700 font-medium">Facing pages</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1.5">Position:</label>
                      <div className="grid grid-cols-3 gap-1 w-24 h-24 border border-slate-300 rounded-xl p-1 bg-slate-50">
                        {[
                          'top-left', 'top-center', 'top-right',
                          'middle-left', 'middle-center', 'middle-right',
                          'bottom-left', 'bottom-center', 'bottom-right'
                        ].map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setPageNumberOptions({ ...pageNumberOptions, position: pos })}
                            className={`rounded-md transition-colors flex items-center justify-center cursor-pointer ${
                              pageNumberOptions.position === pos
                                ? 'bg-rose-500 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${pageNumberOptions.position === pos ? 'bg-white' : 'bg-slate-400'}`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1.5">Margin:</label>
                      <select
                        value={pageNumberOptions.margin}
                        onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, margin: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value="small">Small</option>
                        <option value="recommended">Recommended</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">First number:</span>
                      <input
                        type="number"
                        min="1"
                        value={pageNumberOptions.firstNumber}
                        onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, firstNumber: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        className="w-20 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-bold"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Which pages do you want to number?</label>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">from</span>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={pageNumberOptions.fromPage}
                          onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, fromPage: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                          className="w-14 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-medium"
                        />
                        <span className="text-slate-500">to</span>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={pageNumberOptions.toPage}
                          onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, toPage: Math.min(totalPages, parseInt(e.target.value, 10) || totalPages) })}
                          className="w-14 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block">Text:</label>
                    <select
                      value={pageNumberOptions.textPreset}
                      onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, textPreset: e.target.value })}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="number-only">Insert only page number (recommended)</option>
                      <option value="page-n">Page &#123;n&#125;</option>
                      <option value="page-n-of-p">Page &#123;n&#125; of &#123;p&#125;</option>
                      <option value="custom">Custom</option>
                    </select>

                    {pageNumberOptions.textPreset === 'custom' && (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={pageNumberOptions.customText}
                          onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, customText: e.target.value })}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                        />
                        <p className="text-[10px] text-slate-400">Placeholders: &#123;n&#125;, Page &#123;n&#125;, Page &#123;n&#125; of &#123;p&#125;</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="font-semibold text-slate-700 block text-[11px]">Text format:</label>
                    <div className="flex items-center space-x-2">
                      <select
                        value={pageNumberOptions.fontFamily}
                        onChange={(e) => setPageNumberOptions({ ...pageNumberOptions, fontFamily: e.target.value })}
                        className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="Helvetica">Arial / Helvetica</option>
                        <option value="Times">Times New Roman</option>
                        <option value="Courier">Courier</option>
                      </select>

                      <div className="flex items-center space-x-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => setPageNumberOptions({ ...pageNumberOptions, isBold: !pageNumberOptions.isBold })}
                          className={`px-2.5 py-1 font-bold rounded cursor-pointer ${pageNumberOptions.isBold ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => setPageNumberOptions({ ...pageNumberOptions, isItalic: !pageNumberOptions.isItalic })}
                          className={`px-2.5 py-1 italic rounded cursor-pointer ${pageNumberOptions.isItalic ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => setPageNumberOptions({ ...pageNumberOptions, isUnderline: !pageNumberOptions.isUnderline })}
                          className={`px-2.5 py-1 underline rounded cursor-pointer ${pageNumberOptions.isUnderline ? 'bg-rose-500 text-white' : 'text-slate-600'}`}
                        >
                          U
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={executeAction}
                    disabled={isProcessing || isRenderingPages}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Add page numbers</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* 6. Rotate PDF Studio */}
            {tool?.id === 'rotate' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-purple-50 rounded-2xl border border-purple-100 text-xs">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="font-semibold text-purple-950 truncate">{files[0]?.name}</span>
                    <span className="text-purple-600 font-medium">({thumbnails.length} pages)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => rotateAllPages(90)} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition flex items-center space-x-1 shadow-sm cursor-pointer">
                      <RotateCw className="w-4 h-4" /><span>Rotate All 90°</span>
                    </button>
                    <button onClick={() => rotateAllPages(-90)} className="px-3 py-2 bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-semibold transition flex items-center space-x-1 cursor-pointer">
                      <RotateCcw className="w-4 h-4" /><span>-90°</span>
                    </button>
                    <button onClick={() => changeFileInputRef.current?.click()} className="px-3 py-2 bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-semibold transition flex items-center space-x-1 cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" /><span>Change</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {thumbnails.map((thumb, idx) => (
                    <div key={thumb.id} className="group relative rounded-2xl border-2 bg-slate-50 overflow-hidden border-slate-200 hover:border-purple-400 p-2 shadow-xs transition">
                      <div className="p-2 flex items-center justify-center min-h-[160px]">
                        <img src={thumb.dataUrl} alt={`Page ${idx + 1}`} style={{ transform: `rotate(${thumb.rotation}deg)` }} className="max-h-36 object-contain transition duration-200" />
                      </div>
                      <div className="absolute top-2 right-2">
                        <button onClick={() => rotateSinglePage(idx, 90)} className="p-2 bg-white/95 text-slate-700 rounded-xl shadow hover:text-purple-600 transition cursor-pointer">
                          <RotateCw className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="px-2 py-1 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>Page {idx + 1}</span>
                        <span className={thumb.rotation !== 0 ? 'text-purple-600 font-bold' : 'text-slate-400'}>{thumb.rotation}°</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={executeAction} disabled={isProcessing} className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Rotated PDF</span>}
                </button>
              </div>
            )}

            {/* 7. Organize PDF Studio */}
            {tool?.id === 'organize' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Drag & drop pages to rearrange. Hover to rotate or delete individual pages.</span>
                  <button onClick={() => changeFileInputRef.current?.click()} className="text-amber-700 hover:text-amber-800 font-bold flex items-center space-x-1 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" /><span>Change File</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {thumbnails.map((thumb, idx) => (
                    <div
                      key={thumb.id}
                      draggable
                      onDragStart={(e) => handlePageDragStart(e, idx)}
                      onDragOver={handlePageDragOver}
                      onDrop={(e) => handlePageDrop(e, idx)}
                      className={`group relative rounded-2xl border-2 bg-slate-50 overflow-hidden cursor-grab active:cursor-grabbing p-2 shadow-xs transition ${
                        draggedPageIndex === idx ? 'opacity-40 border-amber-400' : 'border-slate-200 hover:border-amber-400'
                      }`}
                    >
                      <div className="p-2 flex items-center justify-center min-h-[160px]">
                        <img src={thumb.dataUrl} alt={`Page ${idx + 1}`} style={{ transform: `rotate(${thumb.rotation}deg)` }} className="max-h-36 object-contain transition duration-200" />
                      </div>
                      <div className="absolute top-2 right-2 flex space-x-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition">
                        <button onClick={() => rotateSinglePage(idx, 90)} className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-amber-600 cursor-pointer"><RotateCw className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteSinglePage(idx)} className="p-1.5 bg-white text-slate-700 rounded-lg shadow hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="px-2 py-1 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>Pos: {idx + 1}</span>
                        {thumb.rotation !== 0 && <span className="text-amber-600 font-bold">{thumb.rotation}°</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={executeAction} disabled={isProcessing} className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Organized PDF</span>}
                </button>
              </div>
            )}

            {/* 8. Remove / Extract Pages Studio */}
            {(tool?.id === 'remove' || tool?.id === 'extract') && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Pages to {tool?.id === 'remove' ? 'remove' : 'extract'} (Type range or click thumbnails):</span>
                  <button onClick={() => changeFileInputRef.current?.click()} className="text-rose-600 hover:text-rose-700 font-bold flex items-center space-x-1 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" /><span>Change File</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 1, 3-5, 8"
                  value={rangeInput}
                  onChange={handleRangeInputChange}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {thumbnails.map((thumb) => {
                    const isSelected = selectedPages.has(thumb.pageNumber);
                    const isRemove = tool?.id === 'remove';
                    return (
                      <div
                        key={thumb.pageNumber}
                        onClick={() => togglePageSelection(thumb.pageNumber)}
                        className={`group relative rounded-2xl border-2 overflow-hidden cursor-pointer transition p-2 bg-slate-50 ${
                          isSelected
                            ? isRemove
                              ? 'border-red-500 ring-2 ring-red-400/20'
                              : 'border-emerald-500 ring-2 ring-emerald-400/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <img src={thumb.dataUrl} alt={`Page ${thumb.pageNumber}`} className={`w-full h-auto object-cover ${isSelected ? 'opacity-50' : ''}`} />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center shadow ${isRemove ? 'bg-red-500' : 'bg-emerald-600'}`}>
                              {isRemove ? <Trash2 className="w-4 h-4" /> : <Check className="w-4 h-4 stroke-[3]" />}
                            </div>
                          </div>
                        )}
                        <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/80 text-white">{thumb.pageNumber}</span>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={executeAction}
                  disabled={isProcessing || selectedPages.size === 0}
                  className={`w-full py-4 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer ${
                    tool?.id === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{tool?.id === 'remove' ? `Remove ${selectedPages.size} Pages` : `Extract ${selectedPages.size} Pages`}</span>}
                </button>
              </div>
            )}

            {/* 9. Compress PDF Studio */}
            {tool?.id === 'compress' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-2xl mx-auto space-y-6 shadow-sm">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <div className="flex items-center space-x-2.5 truncate">
                    <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-800 truncate">{files[0]?.name}</span>
                    <span className="text-slate-400 font-medium">({formatFileSize(files[0]?.size)})</span>
                  </div>
                  <button onClick={() => changeFileInputRef.current?.click()} className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center space-x-1 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" /><span>Change File</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Compression Preset</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { percent: 25, label: 'Low', desc: 'Maximum Quality' },
                      { percent: 45, label: 'Recommended', desc: 'Balanced Quality & Size' },
                      { percent: 75, label: 'High', desc: 'Smallest File Size' }
                    ].map((preset) => (
                      <button
                        key={preset.percent}
                        type="button"
                        onClick={() => setCompressionPercent(preset.percent)}
                        className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                          compressionPercent === preset.percent ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex justify-between font-bold text-xs text-slate-800">
                          <span>{preset.label}</span>
                          <span className="text-emerald-600">~{preset.percent}%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">{preset.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5"><Sliders className="w-4 h-4 text-slate-500" /> Target Compression Ratio</span>
                    <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">{compressionPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={compressionPercent}
                    onChange={(e) => setCompressionPercent(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                <button onClick={executeAction} disabled={isProcessing} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Compress PDF (~{compressionPercent}%)</span>}
                </button>
              </div>
            )}

            {/* 10. Single File Conversions */}
            {['word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'html-to-pdf', 'pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel', 'pdf-to-jpg', 'to-markdown'].includes(tool?.id) && (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg mx-auto space-y-6 shadow-sm">
                <div className="space-y-4">
                  <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-400">
                    Uploaded Document
                  </div>

                  {files[0] && renderSingleFileThumbnailCard(files[0])}

                  {tool?.id === 'html-to-pdf' && htmlInputMode === 'code' && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-600 truncate">
                      {rawHtmlCode.substring(0, 100)}...
                    </div>
                  )}
                </div>

                <button
                  onClick={executeAction}
                  disabled={isProcessing}
                  className={`w-full py-4 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer ${
                    tool?.id === 'word-to-pdf' || tool?.id === 'pdf-to-word' || tool?.id === 'to-markdown' ? 'bg-blue-600 hover:bg-blue-700' :
                    tool?.id === 'powerpoint-to-pdf' || tool?.id === 'pdf-to-powerpoint' ? 'bg-orange-600 hover:bg-orange-700' :
                    tool?.id === 'excel-to-pdf' || tool?.id === 'pdf-to-excel' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    tool?.id === 'html-to-pdf' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Converting document...</span>
                    </div>
                  ) : (
                    <>
                      <span>{tool?.id === 'to-markdown' ? 'Convert to Markdown' : tool?.id.endsWith('-to-pdf') ? 'Convert to PDF' : 'Convert Document'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 11. Visual Merge PDF Studio */}
            {tool?.id === 'merge' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 text-xs">
                  <div>
                    <span className="font-bold text-slate-800 text-sm">
                      PDF Documents to Merge ({files.length})
                    </span>
                    <p className="text-slate-400 mt-0.5">Drag & drop cards to reorder merge sequence. Output will follow left-to-right order.</p>
                  </div>

                  <label htmlFor="studioAddMorePdfsInput" className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5 transition self-start sm:self-auto">
                    <Plus className="w-4 h-4" />
                    <span>Add More Files</span>
                    <input
                      type="file"
                      id="studioAddMorePdfsInput"
                      multiple
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleAddMorePdfs}
                    />
                  </label>
                </div>

                {isLoadingMergePreviews ? (
                  <div className="py-24 text-center text-slate-400 space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-rose-500" />
                    <p className="text-xs">Generating document previews...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[500px] overflow-y-auto pr-1">
                    {mergeCards.map((card, idx) => (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => handleMergeDragStart(e, idx)}
                        onDragOver={handleMergeDragOver}
                        onDrop={(e) => handleMergeDrop(e, idx)}
                        className={`group relative rounded-2xl border-2 bg-slate-50 overflow-hidden cursor-grab active:cursor-grabbing p-2 shadow-xs transition ${
                          draggedMergeIndex === idx ? 'opacity-40 scale-95 border-rose-400' : 'border-slate-200 hover:border-rose-400 hover:shadow-md'
                        }`}
                      >
                        <div className="p-2 flex items-center justify-center min-h-[160px] bg-white rounded-xl border border-slate-100">
                          {card.previewUrl ? (
                            <img src={card.previewUrl} alt={card.file.name} className="max-h-36 object-contain shadow-xs" />
                          ) : (
                            <FileText className="w-12 h-12 text-slate-300" />
                          )}
                        </div>

                        <div className="absolute top-3 right-3 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => deleteMergeCard(idx)}
                            className="p-1.5 bg-white text-slate-600 hover:text-red-600 rounded-lg shadow cursor-pointer transition"
                            title="Remove from merge"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="px-2 py-1.5 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600 mt-1 rounded-b-xl">
                          <div className="flex items-center space-x-1 truncate max-w-[90px]">
                            <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{card.file.name}</span>
                          </div>
                          <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                            {idx + 1} ({card.pageCount}p)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {files.length < 2 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-2xl font-medium">
                    At least 2 PDF files are required to merge. Please add more files using the button above.
                  </p>
                )}

                <button
                  onClick={executeAction}
                  disabled={isProcessing || files.length < 2 || isLoadingMergePreviews}
                  className="w-full py-4 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Merging {files.length} PDF Documents...</span>
                    </div>
                  ) : (
                    <>
                      <span>Merge {files.length} PDFs</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 max-w-lg mx-auto text-center space-y-6 shadow-md my-auto">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h3 className="text-xl font-bold text-slate-900">Task Completed Successfully!</h3>

            {tool?.id === 'compress' && result.originalSize && result.compressedSize && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-around text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Original</p>
                  <p className="font-bold text-slate-700">{formatFileSize(result.originalSize)}</p>
                </div>
                <TrendingDown className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Compressed</p>
                  <p className="font-bold text-emerald-700">{formatFileSize(result.compressedSize)}</p>
                </div>
                <span className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-xs font-extrabold">
                  -{Math.max(0, Math.round(((result.originalSize - result.compressedSize) / result.originalSize) * 100))}%
                </span>
              </div>
            )}

            <p className="text-xs text-slate-500 truncate px-4">
              Generated file: <strong className="text-slate-800">{result.filename}</strong>
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleReconfigureSameFile}
                  className="flex-1 py-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                  <span>Edit & Reconfigure</span>
                </button>

                <button onClick={onBack} className="flex-1 py-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition cursor-pointer">
                  Return to Home
                </button>
              </div>

              <a
                href={result.url}
                download={result.filename}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 text-center flex items-center justify-center space-x-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}