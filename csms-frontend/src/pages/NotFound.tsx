import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="text-center max-w-md">
        <div className="text-9xl font-extrabold gradient-text mb-6 select-none">
          404
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Page Not Found
        </h1>
        <p className="text-md text-muted-foreground mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold hover:opacity-90 transition"
        >
          Go Back Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;