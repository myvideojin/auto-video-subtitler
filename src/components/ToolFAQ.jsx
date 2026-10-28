import React from 'react';
import { HelpCircle } from 'lucide-react';

export default function ToolFAQ({ faqs }) {
  if (!faqs || faqs.length === 0) return null;

  return (
    <div className="mt-20 max-w-4xl mx-auto border-t border-white/10 pt-14">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center justify-center gap-3 text-white">
          <HelpCircle className="text-blue-500" size={28} />
          Frequently Asked Questions
        </h2>
      </div>
      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div key={index} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <h3 className="text-base sm:text-lg font-bold mb-2 text-white">{faq.question}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
