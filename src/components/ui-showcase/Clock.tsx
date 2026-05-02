"use client";

import { useEffect, useState } from "react";

export default function Clock() {
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime({
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        milliseconds: now.getMilliseconds(),
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 16);
    return () => clearInterval(interval);
  }, []);

  const secondsDeg = (time.seconds + time.milliseconds / 1000) * 6;
  const minutesDeg = (time.minutes + time.seconds / 60) * 6;
  const hoursDeg = ((time.hours % 12) + time.minutes / 60) * 30;

  return (
    <div className="relative w-80 h-80 md:w-96 md:h-96">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 100%)",
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.03),
            0 20px 60px rgba(0,0,0,0.8),
            inset 0 1px 0 rgba(255,255,255,0.05),
            inset 0 -1px 0 rgba(0,0,0,0.5)
          `,
        }}
      />

      <div
        className="absolute inset-4 rounded-full"
        style={{
          background: "radial-gradient(circle at 30% 30%, #1f1f1f 0%, #0d0d0d 70%)",
          boxShadow: "inset 0 2px 10px rgba(0,0,0,0.8)",
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 w-0.5 h-3 origin-bottom"
              style={{
                transform: `translateX(-50%) translateY(-50%) rotate(${i * 30}deg) translateY(-140px)`,
              }}
            >
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: i % 3 === 0 ? "rgba(212,175,118,0.9)" : "rgba(255,255,255,0.3)",
                  boxShadow: i % 3 === 0 ? "0 0 8px rgba(212,175,118,0.4)" : "none",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute left-1/2 top-1/2 w-1 h-28 origin-bottom rounded-full"
        style={{
          transform: `translateX(-50%) translateY(-100%) rotate(${hoursDeg}deg)`,
          background: "linear-gradient(to top, #d4af76 0%, #f5e6c8 100%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          transition: "transform 0.5s ease-out",
        }}
      />

      <div
        className="absolute left-1/2 top-1/2 w-0.5 h-40 origin-bottom rounded-full"
        style={{
          transform: `translateX(-50%) translateY(-100%) rotate(${minutesDeg}deg)`,
          background: "linear-gradient(to top, #e8e8e8 0%, #ffffff 100%)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
          transition: "transform 0.3s ease-out",
        }}
      />

      <div
        className="absolute left-1/2 top-1/2 w-px h-44 origin-bottom rounded-full"
        style={{
          transform: `translateX(-50%) translateY(-100%) rotate(${secondsDeg}deg)`,
          background: "#d4af76",
          boxShadow: "0 0 10px rgba(212,175,118,0.6)",
          transition: "transform 0.05s linear",
        }}
      />

      <div
        className="absolute left-1/2 top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "linear-gradient(135deg, #f5e6c8 0%, #d4af76 100%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}
      />

      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
        style={{ transform: "translate(-50%, 60%)" }}
      >
        <div
          className="text-[0.6rem] tracking-[0.3em] uppercase"
          style={{ color: "rgba(212,175,118,0.7)", fontFamily: "'Didot', 'Playfair Display', serif" }}
        >
          Automaton
        </div>
      </div>

      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 w-px h-4"
        style={{ background: "rgba(212,175,118,0.4)" }}
      />
    </div>
  );
}