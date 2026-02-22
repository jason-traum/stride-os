'use client';

import { motion } from 'framer-motion';

interface CapabilityCardProps {
  heading: string;
  body: string;
  index: number;
}

export function CapabilityCard({ heading, body, index }: CapabilityCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="w2-card-border pl-6 py-4"
    >
      <h3 className="text-xl font-bold text-textPrimary mb-2" style={{ fontFamily: 'var(--font-syne)' }}>
        {heading}
      </h3>
      <p className="text-textTertiary leading-relaxed">{body}</p>
    </motion.div>
  );
}
