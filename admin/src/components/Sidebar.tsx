import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Settings, LogOut, Tag, Menu } from 'lucide-react';
import { clearApiKey } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Feedback', href: '/feedback', icon: MessageSquare },
  { name: 'Tags', href: '/tags', icon: Tag },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarContentProps {
  onNavigate?: () => void;
}

function SidebarContent({ onNavigate }: SidebarContentProps) {
  const location = useLocation();

  const handleLogout = () => {
    clearApiKey();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-6 border-b">
        <h1 className="font-semibold text-lg">Collective Vision</h1>
        <p className="text-xs text-muted-foreground mt-1">Feedback Platform</p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === item.href
                ? 'bg-primary text-primary-foreground font-medium'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile Sidebar - Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-4 left-4 z-40"
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle navigation</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-background border-r">
        <SidebarContent />
      </aside>
    </>
  );
}
