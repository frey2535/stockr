import React, { useState } from "react";
import { Package, Link2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function LinkBarcodeDialog({ open, barcode, candidates, onLink, onCreateNew, onCancel }) {
  const [selected, setSelected] = useState(candidates?.[0]?.id || null);

  if (!open) return null;

  const selectedCandidate = candidates?.find(c => c.id === selected);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-secondary" />
            Barcode Not Assigned
          </DialogTitle>
          <DialogDescription>
            This barcode (<span className="font-mono font-medium text-foreground">{barcode}</span>) is not assigned to any item yet.
            We found existing inventory item(s) that may match. Would you like to link this barcode to one of them?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 my-2">
          {candidates?.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${
                selected === c.id
                  ? "border-secondary bg-secondary/5"
                  : "border-border hover:border-secondary/50 bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                    {c.manufacturer && <span>{c.manufacturer}</span>}
                    {c.category && <span>· {c.category}</span>}
                    {c.unit && <span>· {c.unit}</span>}
                  </div>
                  <p className="text-xs text-orange-500 mt-0.5 font-medium">No barcode assigned</p>
                </div>
                {c.matchScore && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                    {Math.round(c.matchScore * 100)}% match
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
            disabled={!selected}
            onClick={() => onLink(selectedCandidate)}
          >
            <Link2 className="w-4 h-4 mr-2" />
            Link Barcode to "{selectedCandidate?.name}"
          </Button>
          <Button variant="outline" className="w-full" onClick={onCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Item Instead
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}