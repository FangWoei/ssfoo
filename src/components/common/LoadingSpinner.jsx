// src/components/common/LoadingSpinner.jsx
export default function LoadingSpinner({ fullPage = false, size = 32 }) {
  const spinner = (
    <div
      style={{ width: size, height: size }}
      className="rounded-full border-[3px] border-primary-200 border-t-primary-600 animate-spin"
    />
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-950">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">{spinner}</div>
  );
}
