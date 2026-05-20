// src/components/creator/CreatorBookCard.tsx

import { Link } from "react-router-dom";

const API_BASE_URL = "http://127.0.0.1:18001";

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
    <Link to={href} className="group block w-28 sm:w-32">
      <div className="relative aspect-[5/7] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_16px_32px_rgba(15,23,42,0.22)]">
        <div className="absolute inset-y-0 left-0 z-10 w-3 border-r border-black/10 bg-black/10" />

        <div className="absolute inset-0 overflow-hidden border border-[var(--color-border-soft)] bg-[var(--color-panel-soft-bg)]">
          {resolvedCoverUrl ? (
            <img
              src={resolvedCoverUrl}
              alt={title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-700 px-4 text-center text-xs font-semibold leading-5 text-white">
              {title}
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-white/10" />
          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
        </div>
      </div>

      <div className="mt-3 min-h-[74px]">
        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-main group-hover:underline group-hover:underline-offset-4">
          {title}
        </h3>

        {summary ? (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
            {summary}
          </p>
        ) : (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-soft">
            暂无简介
          </p>
        )}

        {meta && <p className="mt-1 text-[11px] text-soft">{meta}</p>}
      </div>
    </Link>
  );
}