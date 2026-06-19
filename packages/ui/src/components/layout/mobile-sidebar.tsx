import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";

interface MobileSidebarProps {
	open: boolean;
	onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
	useEffect(() => {
		if (open) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [open]);

	if (!open) return null;

	return createPortal(
		<div className="fixed inset-0 z-50 md:hidden">
			<div className="absolute inset-0 bg-black/50" onClick={onClose} />
			<div className="absolute inset-y-0 left-0 w-64 bg-surface-1 shadow-xl">
				<div className="flex h-16 items-center justify-end pr-3">
					<Button variant="ghost" size="icon" onClick={onClose}>
						<X className="h-5 w-5" />
					</Button>
				</div>
				<Sidebar />
			</div>
		</div>,
		document.body,
	);
}
