import React, { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const REVIEWS = [
  {
    name: 'Kalpana Verma',
    role: 'Teacher',
    rating: 5,
    comment: 'PDFForge made combining and rearranging sprint reports effortless. The in-browser speed and privacy promise give us complete peace of mind.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  },
  {
    name: 'Shashi Sharma',
    role: 'Software Engineer',
    rating: 5,
    comment: 'The Excel conversion tool extracted our quarterly balance sheet tables cleanly without messing up numeric values or headers.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  },
  {
    name: 'Priya',
    role: 'Student',
    rating: 5,
    comment: 'Organizing thesis pages and compressing heavy research papers without quality loss saved me hours of work before final submission.',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
  },
  {
    name: 'Ravjyot',
    role: 'Computer Analyst',
    rating: 5,
    comment: 'Clean UI, zero annoying paywalls, and genuinely respects user privacy. The Markdown extraction tool is a huge plus for documentation.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  },
  {
    name: 'Vicky Sethi',
    role: 'MBBS Doctor',
    rating: 5,
    comment: 'Splitting invoices and converting images to PDFs on mobile and desktop works smoothly every single time. An indispensable toolkit.',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop&q=80',
  },
];

export default function Reviews() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-scroll carousel every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % REVIEWS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? REVIEWS.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % REVIEWS.length);
  };

  const review = REVIEWS[currentIndex];

  return (
    <section className="py-16 bg-gradient-to-b from-slate-50 to-slate-100/80 border-t border-slate-200/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-2">Loved by Users Worldwide</h2>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          What our community says about PDFForge
        </h3>

        {/* Carousel Card */}
        <div className="mt-8 relative bg-white rounded-3xl p-8 sm:p-10 shadow-lg border border-slate-200/70 transition-all">
          <Quote className="w-10 h-10 text-rose-100 absolute top-6 left-6 -z-0" />

          <div className="relative z-10 flex flex-col items-center">
            {/* Stars */}
            <div className="flex space-x-1 mb-4">
              {[...Array(review.rating)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>

            {/* Testimonial */}
            <p className="text-base sm:text-lg text-slate-700 font-medium italic max-w-2xl leading-relaxed">
              "{review.comment}"
            </p>

            {/* User Info */}
            <div className="mt-6 flex items-center space-x-3.5">
              <img
                src={review.avatar}
                alt={review.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-rose-400/30 shadow-sm"
              />
              <div className="text-left">
                <h4 className="font-bold text-slate-900 text-sm">{review.name}</h4>
                <p className="text-xs text-slate-500">{review.role}</p>
              </div>
            </div>
          </div>

          {/* Carousel Arrows */}
          <button
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition shadow-sm border border-slate-200/70"
            title="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition shadow-sm border border-slate-200/70"
            title="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Indicator Dots */}
        <div className="flex justify-center space-x-2 mt-6">
          {REVIEWS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                currentIndex === idx ? 'w-6 bg-rose-500' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}