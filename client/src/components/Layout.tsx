import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Calendar, BookOpen, UtensilsCrossed, GraduationCap, ListChecks, Package, LogOut, User, Menu, X, Utensils } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/plan', label: 'Plan', icon: Calendar },
  { path: '/recipes', label: 'Recipes', icon: BookOpen },
  { path: '/bento', label: 'Bento', icon: Package },
  { path: '/leftovers', label: 'Leftovers', icon: UtensilsCrossed },
  { path: '/school-menu', label: 'School Menu', icon: GraduationCap },
  { path: '/lists', label: 'Lists', icon: ListChecks },
  { path: '/restaurants', label: 'Restaurants', icon: Utensils },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const isPlanPage = location.pathname === '/plan';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
        <div className="container flex h-14 sm:h-16 items-center px-3 sm:px-4">
          {/* Logo and Title */}
          <Link to="/plan" className="flex items-center space-x-2 mr-4 hover:opacity-80 transition-opacity">
            <UtensilsCrossed className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
            <h1 className="text-base sm:text-lg md:text-xl font-bold truncate">
              <span className="hidden sm:inline">Family Meal Planner</span>
              <span className="sm:hidden">Meal Planner</span>
            </h1>
          </Link>

          {/* Desktop Navigation - Large screens only */}
          <nav className="hidden lg:flex flex-1 items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-3 py-2",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50 hover:text-accent-foreground"
                  )}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop User Menu - Large screens only */}
          <div className="hidden lg:flex items-center gap-3 xl:gap-4 ml-auto">
            <Link
              to="/profile"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <User className="h-4 w-4" />
              <span className="hidden xl:inline">{user?.display_name || user?.username}</span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline">Logout</span>
            </Button>
          </div>

          {/* Mobile/Tablet Menu Button */}
          <div className="lg:hidden ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground mr-2">
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline max-w-[80px] md:max-w-none truncate">
                {user?.display_name || user?.username}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-9 w-9 p-0"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile/Tablet Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t bg-background">
            <nav className="container py-2 px-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50 hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  location.pathname === '/profile'
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 hover:text-accent-foreground"
                )}
              >
                <User className="h-5 w-5" />
                Profile
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full justify-start gap-3 px-3 py-2.5 h-auto text-sm font-medium"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={cn(
        isPlanPage
          ? "flex-1 overflow-hidden"
          : "container py-4 sm:py-6 px-3 sm:px-4 lg:px-6"
      )}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
