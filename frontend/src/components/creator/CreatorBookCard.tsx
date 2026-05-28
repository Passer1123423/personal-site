// src/components/creator/CreatorBookCard.tsx

import { Link } from "react-router-dom";

import { API_BASE_URL } from "../../api/config";

function resolveCoverUrl(coverUrl?: string | null) {
  if (!coverUrl) {
    return null;
  }

  if (coverUrl.startsWith("http://") || coverUrl.startsWith("https://")) {
    return coverUrl;
  }

  return `${API_BASE_URL}${coverUrl}`;
}

type CreatorBookCardProps = {
  title: string;
  summary?: string | null;
  coverUrl?: string | null;
  href: string;
  meta?: string;
};

export default function CreatorBookCard({
  title,
  summary,
  coverUrl,
  href,
  meta,
}: CreatorBookCardProps) {
  const resolvedCoverUrl = resolveCoverUrl(coverUrl);

  return (
    <Link to={href} className="group block w-24 sm:w-32">
      <div className="relative aspect-[5/7] bg-white shadow-[0_6px_16px_rgba(15,23,42,0.12)] transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_16px_32px_rgba(15,23,42,0.22)] sm:shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
        <div className="absolute inset-y-0 left-0 z-10 w-2.5 border-r border-black/10 bg-black/10 sm:w-3" />

        <div className="absolute inset-0 overflow-hidden border border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)]">
          {resolvedCoverUrl ? (
            <img
              src={resolvedCoverUrl}
              alt={title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-700 px-3 text-center text-[11px] font-semibold leading-4 text-white sm:px-4 sm:text-xs sm:leading-5">
              {title}
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-white/10" />
          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
        </div>
      </div>

      <div className="mt-2 min-h-[64px] sm:mt-3 sm:min-h-[74px]">
        <h3 className="line-clamp-2 text-xs font-semibold leading-4 text-main group-hover:underline group-hover:underline-offset-4 sm:text-sm sm:leading-5">
          {title}
        </h3>

        {summary ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted sm:text-xs sm:leading-5">
            {summary}
          </p>
        ) : (
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-soft sm:text-xs sm:leading-5">
            暂无简介
          </p>
        )}

        {meta && (
          <p className="mt-1 text-[10px] text-soft sm:text-[11px]">
            {meta}
          </p>
        )}
      </div>
    </Link>
  );
}