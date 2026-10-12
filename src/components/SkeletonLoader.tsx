import React from 'react';

export const HeroSkeleton: React.FC = () => {
  return (
    <div
      className="relative w-full min-h-[540px] lg:min-h-[680px] bg-[#0D0D10] overflow-hidden flex items-end pb-16 pt-28"
      aria-busy="true"
      aria-label="Loading featured title"
    >
      <div className="max-w-[1440px] mx-auto w-full px-6 md:px-12">
        <div className="max-w-2xl space-y-5 animate-pulse">
          <div className="h-4 w-44 bg-zinc-800/80 rounded" />
          <div className="h-12 md:h-16 w-3/4 bg-zinc-800/90 rounded-lg" />
          <div className="space-y-2.5 pt-1">
            <div className="h-4 w-full bg-zinc-800/70 rounded" />
            <div className="h-4 w-11/12 bg-zinc-800/70 rounded" />
            <div className="h-4 w-2/3 bg-zinc-800/70 rounded" />
          </div>
          <div className="flex items-center gap-4 pt-3">
            <div className="h-12 w-40 bg-zinc-800 rounded-lg" />
            <div className="h-12 w-36 bg-zinc-800/70 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="w-full animate-pulse" aria-hidden="true">
      <div className="aspect-[2/3] w-full rounded-xl bg-[#141418] border border-white/[0.06]" />
      <div className="mt-2.5 space-y-1.5">
        <div className="h-4 w-4/5 bg-zinc-800/80 rounded" />
        <div className="h-3 w-1/2 bg-zinc-800/50 rounded" />
      </div>
    </div>
  );
};

export const RowSkeleton: React.FC<{ title?: string; count?: number }> = ({
  title,
  count = 6,
}) => {
  return (
    <section className="py-5 px-6 md:px-12 max-w-[1440px] mx-auto" aria-busy="true">
      {title ? (
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-100 mb-4">
          {title}
        </h2>
      ) : (
        <div className="h-7 w-48 bg-zinc-800/80 rounded mb-4 animate-pulse" />
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: count }).map((_, idx) => (
          <CardSkeleton key={idx} />
        ))}
      </div>
    </section>
  );
};

export const GridSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5"
      aria-busy="true"
      aria-label="Loading titles"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <CardSkeleton key={idx} />
      ))}
    </div>
  );
};
