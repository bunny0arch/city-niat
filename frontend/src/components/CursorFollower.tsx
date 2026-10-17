import { useEffect, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';

const motionTokens = {
  spring: { stiffness: 360, damping: 34, mass: 0.35 },
};

export function CursorFollower() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const x = useMotionValue(-40);
  const y = useMotionValue(-40);
  const springX = useSpring(x, motionTokens.spring);
  const springY = useSpring(y, motionTokens.spring);

  useEffect(() => {
    if (reduce || !window.matchMedia('(pointer: fine)').matches) return;
    const move = (event: MouseEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      setVisible(true);
      const target = event.target as HTMLElement | null;
      setInteractive(Boolean(target?.closest('button, a, input, textarea, select, [role="button"]')));
    };
    const leave = () => setVisible(false);
    window.addEventListener('mousemove', move, { passive: true });
    document.documentElement.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('mousemove', move);
      document.documentElement.removeEventListener('mouseleave', leave);
    };
  }, [reduce, x, y]);

  if (reduce) return null;
  return (
    <motion.span
      aria-hidden="true"
      className={`ops-cursor-follower${visible ? ' is-visible' : ''}${interactive ? ' is-interactive' : ''}`}
      style={{ x: springX, y: springY }}
    />
  );
}
