import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import {
  Calendar,
  BookOpen,
  UtensilsCrossed,
  GraduationCap,
  Package,
  LogOut,
  User,
  Menu,
  X,
  Utensils,
  Bug,
  Leaf,
  ShoppingCart,
  MoreHorizontal,
  PartyPopper
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface LayoutProps {
  children: React.ReactNode;
}

// Primary navigation - core workflow
const primaryNavItems = [
  { path: '/plan', label: 'Meal Plan', icon: Calendar, description: 'Weekly meal planning' },
  { path: '/recipes', label: 'Recipes', icon: BookOpen, description: 'Recipe library' },
  { path: '/lists', label: 'Shopping List', icon: ShoppingCart, description: 'Shopping lists' },
];

// Secondary navigation - additional features
const secondaryNavItems = [
  { path: '/holiday', label: 'Holiday Planner', icon: PartyPopper, description: 'Plan holiday meals' },
  { path: '/seasonal', label: 'Seasonal Cooking', icon: Leaf, description: 'Fresh & seasonal produce' },
  { path: '/bento', label: 'Bento', icon: Package, description: 'Bento meal prep' },
  { path: '/leftovers', label: 'Leftovers', icon: UtensilsCrossed, description: 'Track leftovers' },
  { path: '/school-menu', label: 'School Menu', icon: GraduationCap, description: 'School lunches' },
  { path: '/restaurants', label: 'Restaurants', icon: Utensils, description: 'Restaurant finder' },
  { path: '/diagnostics', label: 'Diagnostics', icon: Bug, description: 'System diagnostics' },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      // Logout already handles errors internally, but we catch here to prevent unhandled rejection
      console.error('[Layout] Logout error:', error);
    }
  };

  const isPlanPage = location.pathname === '/plan';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header
        className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-shadow"
        role="banner"
      >
        <div className="container flex h-14 sm:h-16 items-center px-4 sm:px-6">
          {/* Logo and Title */}
          <Link
            to="/plan"
            className="flex items-center gap-2 mr-4 hover:opacity-80 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md flex-shrink-0"
            aria-label="Family Meal Planner - Home"
          >
            <UtensilsCrossed
              className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0"
              aria-hidden="true"
            />
            <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight whitespace-nowrap">
              <span className="hidden sm:inline">Family Meal Planner</span>
              <span className="sm:hidden">Meal Planner</span>
            </h1>
          </Link>

          {/* Desktop Navigation */}
          <nav
            className="hidden lg:flex flex-1 items-center gap-1 ml-4"
            aria-label="Main navigation"
          >
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150",
                    "h-9 px-3 py-2 gap-2",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    isActive
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                  )}
                  aria-label={`${item.label} - ${item.description}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* More Menu - Secondary Items */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 px-3 gap-2",
                    secondaryNavItems.some(item => location.pathname === item.path)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span>More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <div className="px-2 py-1.5 text-sm font-semibold">Additional Features</div>
                <DropdownMenuSeparator />
                {secondaryNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link
                        to={item.path}
                        className={cn(
                          "flex items-center gap-2 cursor-pointer",
                          isActive && "bg-accent"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{item.label}</span>
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Desktop User Menu */}
          <div className="hidden lg:flex items-center gap-3 ml-auto">
            <Link
              to="/profile"
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                location.pathname === '/profile'
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
              aria-label={`Profile - ${user?.display_name || user?.username}`}
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span className="hidden xl:inline max-w-[120px] truncate">
                {user?.display_name || user?.username}
              </span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden xl:inline">Logout</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden ml-auto flex items-center gap-2">
            <div
              className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground mr-1"
              aria-hidden="true"
            >
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="max-w-[80px] truncate">
                {user?.display_name || user?.username}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-11 w-11 p-0 min-h-[44px]"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="lg:hidden fixed inset-0 top-14 sm:top-16 bg-background/80 backdrop-blur-sm z-30 animate-fade-in"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Menu Content */}
            <div
              id="mobile-menu"
              className="lg:hidden border-t bg-background/95 backdrop-blur z-40 animate-slide-in-from-top relative"
              role="navigation"
              aria-label="Mobile navigation"
            >
              <nav className="container max-h-[calc(100vh-4rem)] overflow-y-auto py-3 px-4 space-y-1">
                {/* Primary Navigation */}
                {primaryNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "min-h-[44px]", // Touch-friendly target size
                        isActive
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "text-foreground hover:bg-accent/50"
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                      <div className="flex-1">
                        <div>{item.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {/* Divider */}
                <div className="h-px bg-border my-2" role="separator" />
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">Additional Features</div>

                {/* Secondary Navigation */}
                {secondaryNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "min-h-[44px]",
                        isActive
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "text-foreground hover:bg-accent/50"
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                      <div className="flex-1">
                        <div>{item.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {/* Divider */}
                <div className="h-px bg-border my-2" role="separator" />

                {/* Profile Link */}
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "min-h-[44px]",
                    location.pathname === '/profile'
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-foreground hover:bg-accent/50"
                  )}
                  aria-current={location.pathname === '/profile' ? 'page' : undefined}
                >
                  <User className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1">
                    <div>Profile</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {user?.display_name || user?.username}
                    </div>
                  </div>
                </Link>

                {/* Logout Button */}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full justify-start gap-3 px-3 py-3 h-auto text-sm font-medium min-h-[44px]"
                  aria-label="Log out"
                >
                  <LogOut className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span>Logout</span>
                </Button>
              </nav>
            </div>
          </>
        )}
      </header>

      {/* Main Content */}
      <main
        id="main-content"
        className={cn(
          isPlanPage
            ? "flex-1 min-h-0 overflow-hidden" // min-h-0 allows flex child to shrink below content size
            : "flex-1 container py-6 px-4 sm:px-6 lg:py-8"
        )}
        role="main"
      >
        {children}
      </main>

      {/* Footer (optional - can be added later) */}
      {/* <footer className="border-t py-6 px-4 mt-auto" role="contentinfo">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Family Meal Planner
        </div>
      </footer> */}
    </div>
  );
};

export default Layout;
