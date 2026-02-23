// src/pages/how-it-works/HowItWorksStep.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { stepsBySlug, steps } from './howItWorksData';
import Navbar from '@/components/site/Navbar';
import Footer from '@/components/site/Footer';
import NotFound from '@/pages/NotFound';

const HowItWorksStep: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const step = slug ? stepsBySlug[slug] : null;

  if (!step) return <NotFound />;

  const Icon = step.icon;
  const prevStep = step.prevSlug ? stepsBySlug[step.prevSlug] : null;
  const nextStep = step.nextSlug ? stepsBySlug[step.nextSlug] : null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className={`${step.bgColor} py-20 px-4 border-b ${step.borderColor}`}>
          <div className="container mx-auto max-w-4xl">
            {/* Breadcrumb */}
            <button
              onClick={() => navigate('/how-it-works')}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors"
            >
              <ArrowLeft size={14} />
              How It Works
            </button>

            <div className="flex items-start gap-6">
              {/* Icon */}
              <div
                className={`flex-shrink-0 w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center ${step.accentColor}`}
              >
                <Icon size={32} />
              </div>

              {/* Title block */}
              <div>
                <p
                  className={`text-sm font-semibold tracking-widest uppercase mb-2 ${step.accentColor}`}
                >
                  Step {step.id} of 5 · {step.label}
                </p>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-3">
                  {step.title}
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl">{step.subtitle}</p>
              </div>
            </div>

            {/* Step progress bar */}
            <div className="flex items-center gap-1.5 mt-10">
              {steps.map(s => (
                <button
                  key={s.slug}
                  onClick={() => navigate(`/how-it-works/${s.slug}`)}
                  title={s.label}
                  className={`h-1.5 rounded-full transition-all ${
                    s.slug === step.slug
                      ? `flex-[3] ${step.accentColor.replace('text-', 'bg-')}`
                      : 'flex-1 bg-gray-200 hover:bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {/* Main content — 2 cols */}
              <div className="md:col-span-2 space-y-10">
                {step.sections.map((section, i) => (
                  <div key={i}>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">{section.heading}</h2>
                    <p className="text-gray-600 leading-relaxed">{section.body}</p>
                  </div>
                ))}
              </div>

              {/* Sidebar — 1 col */}
              <aside className="space-y-6">
                {/* Key points */}
                <div className={`rounded-2xl border ${step.borderColor} ${step.bgColor} p-6`}>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">
                    Key Points
                  </h3>
                  <ul className="space-y-3">
                    {step.keyPoints.map(point => (
                      <li key={point} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle2
                          size={16}
                          className={`flex-shrink-0 mt-0.5 ${step.accentColor}`}
                        />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* All steps nav */}
                <div className="rounded-2xl border border-gray-100 p-6">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">
                    All Steps
                  </h3>
                  <nav className="space-y-1">
                    {steps.map(s => {
                      const SIcon = s.icon;
                      const isActive = s.slug === step.slug;
                      return (
                        <button
                          key={s.slug}
                          onClick={() => navigate(`/how-it-works/${s.slug}`)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                            isActive
                              ? `${step.bgColor} ${step.accentColor} font-semibold`
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <SIcon size={14} />
                          {s.label}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* Prev / Next navigation */}
        <section className="border-t border-gray-100 py-10 px-4">
          <div className="container mx-auto max-w-4xl flex justify-between items-center gap-4">
            {prevStep ? (
              <button
                onClick={() => navigate(`/how-it-works/${prevStep.slug}`)}
                className="flex items-center gap-3 group text-left"
              >
                <ArrowLeft
                  size={18}
                  className="text-gray-400 group-hover:-translate-x-1 transition-transform"
                />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Previous</p>
                  <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
                    {prevStep.label}: {prevStep.title}
                  </p>
                </div>
              </button>
            ) : (
              <div />
            )}

            {nextStep ? (
              <button
                onClick={() => navigate(`/how-it-works/${nextStep.slug}`)}
                className="flex items-center gap-3 group text-right"
              >
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Next</p>
                  <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
                    {nextStep.label}: {nextStep.title}
                  </p>
                </div>
                <ArrowRight
                  size={18}
                  className="text-gray-400 group-hover:translate-x-1 transition-transform"
                />
              </button>
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="flex items-center gap-3 group text-right"
              >
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">You're done!</p>
                  <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
                    Get Started Free →
                  </p>
                </div>
              </button>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HowItWorksStep;
