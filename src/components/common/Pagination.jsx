// src/components/common/Pagination.jsx
// Page-size chip switcher + prev/next controls. Sizes: 20/50/100/300/500.
// Auto-hides when there's nothing to page through.
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export const PAGE_SIZES = [20, 50, 100, 300, 500];
export const DEFAULT_PAGE_SIZE = 50;

export default function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clamp = (p) => Math.min(Math.max(1, p), totalPages);
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  // Hide entirely if everything fits and no larger sizes make sense
  if (total <= PAGE_SIZES[0]) return null;

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap py-2">
      {/* Size chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-dark-500 dark:text-dark-400 mr-1">
          Per page:
        </span>
        {PAGE_SIZES.map((s) => (
          <button
            key={s}
            onClick={() => {
              onPageSizeChange(s);
              onPageChange(1);
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              pageSize === s
                ? "bg-primary-600 text-white"
                : "bg-dark-100 dark:bg-dark-800 text-dark-500 dark:text-dark-400 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/20"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Prev / count / next */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-dark-500 dark:text-dark-400">
          {showingFrom.toLocaleString()}–{showingTo.toLocaleString()} of{" "}
          {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(clamp(page - 1))}
            disabled={page <= 1}
            className="w-8 h-8 rounded-lg border border-dark-200 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-500 hover:text-primary-600 disabled:opacity-40 flex items-center justify-center transition-colors">
            <FiChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-dark-700 dark:text-dark-300 px-2 min-w-[3rem] text-center">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(clamp(page + 1))}
            disabled={page >= totalPages}
            className="w-8 h-8 rounded-lg border border-dark-200 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-500 hover:text-primary-600 disabled:opacity-40 flex items-center justify-center transition-colors">
            <FiChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
