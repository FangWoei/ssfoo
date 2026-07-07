// src/pages/NotFoundPage.jsx
import { FiArrowLeft } from "react-icons/fi";
import { Link } from "react-router-dom";
export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 bg-white dark:bg-dark-950">
      <p className="text-8xl font-display font-bold text-primary-100 dark:text-primary-900/30 mb-2">
        404
      </p>
      <h1 className="text-3xl font-display font-bold text-dark-900 dark:text-dark-100 mb-3">
        Page not found
      </h1>
      <p className="text-dark-500 dark:text-dark-400 mb-8 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="btn-primary gap-2">
        <FiArrowLeft size={16} /> Back to Home
      </Link>
    </div>
  );
}
