import React from 'react';

// One step of the comparison story: numbered title, one plain sentence, then the content.
export default function FlowSection({ id, step, title, subtitle, children }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex-none w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white text-sm font-bold flex items-center justify-center shadow-sm">
          {step}
        </span>
        <div>
          <h3 className="text-lg font-bold text-gray-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5 max-w-3xl">{subtitle}</p>}
        </div>
      </div>
      <div className="md:pl-11">{children}</div>
    </section>
  );
}
