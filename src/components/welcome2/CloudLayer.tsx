'use client';

import { motion, type MotionValue, useTransform } from 'framer-motion';

interface CloudLayerProps {
  scrollProgress: MotionValue<number>;
}

const clouds = [
  { w: 320, h: 55, top: '20%', left: '5%', speed: 0.3, opacity: 0.035 },
  { w: 480, h: 75, top: '38%', left: '55%', speed: 0.5, opacity: 0.045 },
  { w: 260, h: 45, top: '58%', left: '25%', speed: 0.7, opacity: 0.055 },
  { w: 380, h: 60, top: '72%', left: '70%', speed: 0.4, opacity: 0.03 },
];

export function CloudLayer({ scrollProgress }: CloudLayerProps) {
  const overallOpacity = useTransform(scrollProgress, [0, 0.35, 0.50], [1, 0.5, 0]);

  return (
    <motion.div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: overallOpacity }}>
      {clouds.map((cloud, i) => (
        <CloudShape key={i} cloud={cloud} scrollProgress={scrollProgress} />
      ))}
    </motion.div>
  );
}

function CloudShape({
  cloud,
  scrollProgress,
}: {
  cloud: (typeof clouds)[number];
  scrollProgress: MotionValue<number>;
}) {
  const x = useTransform(scrollProgress, [0, 1], [0, cloud.speed * 500]);

  return (
    <motion.div
      className="w2-cloud"
      style={{
        width: cloud.w,
        height: cloud.h,
        top: cloud.top,
        left: cloud.left,
        background: `rgba(255, 255, 255, ${cloud.opacity})`,
        x,
      }}
    />
  );
}
