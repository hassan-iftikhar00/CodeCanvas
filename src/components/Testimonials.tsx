"use client";

import { useState, useEffect } from "react";

const testimonials = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "UI/UX Designer",
    company: "TechCorp",
    quote: "CodeCanvas transformed my workflow. I can sketch ideas and get production code in minutes instead of hours!",
    avatar: "SC",
    rating: 5,
  },
  {
    id: 2,
    name: "Michael Rodriguez",
    role: "Frontend Developer",
    company: "StartupXYZ",
    quote: "The AI detection is incredibly accurate. It understands my sketches better than I expected!",
    avatar: "MR",
    rating: 5,
  },
  {
    id: 3,
    name: "Emily Watson",
    role: "Product Manager",
    company: "InnovateLabs",
    quote: "Perfect for rapid prototyping. Our team can iterate on designs 10x faster now.",
    avatar: "EW",
    rating: 5,
  },
  {
    id: 4,
    name: "David Kim",
    role: "Full Stack Developer",
    company: "DevStudio",
    quote: "Clean code generation and great template library. Saves me hours every week!",
    avatar: "DK",
    rating: 5,
  },
  {
    id: 5,
    name: "Lisa Thompson",
    role: "Design Lead",
    company: "Creative Co",
    quote: "Finally, a tool that bridges the gap between design and development perfectly!",
    avatar: "LT",
    rating: 5,
  },
];

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
  };

  return (
    <section className="relative overflow-hidden py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-bold text-white">
            Loved by Designers & Developers
          </h2>
          <p className="text-xl text-secondary">
            Join thousands of users building UIs faster
          </p>
        </div>

        {/* Testimonial Card */}
        <div className="relative">
          <div className="glass-strong mx-auto max-w-3xl rounded-2xl p-8 md:p-12">
            <div key={currentIndex} className="animate-fade-in">
              {/* Stars */}
              <div className="mb-6 flex justify-center gap-1">
                {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                  <svg
                    key={i}
                    className="h-5 w-5 text-[var(--orange-primary)]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Quote */}
              <blockquote className="mb-8 text-center text-xl font-medium leading-relaxed text-white md:text-2xl">
                "{testimonials[currentIndex].quote}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center justify-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--orange-primary)] text-white font-bold">
                  {testimonials[currentIndex].avatar}
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {testimonials[currentIndex].name}
                  </div>
                  <div className="text-sm text-secondary">
                    {testimonials[currentIndex].role} at {testimonials[currentIndex].company}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Dots */}
          <div className="mt-8 flex justify-center gap-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? "w-8 bg-[var(--orange-primary)]"
                    : "w-2 bg-[var(--grey-700)] hover:bg-[var(--grey-600)]"
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
