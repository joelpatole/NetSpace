import { ShieldAlert } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="flex-shrink-0 px-4 py-2 border-t border-ns-border/50 bg-ns-card/50
                       flex items-center justify-center gap-2 text-[10px] text-ns-text-secondary/60"
            id="app-footer">
      <ShieldAlert className="w-3 h-3" />
      <span>
        This tool should only be run on networks you own or are authorized to administer.
      </span>
    </footer>
  );
}
