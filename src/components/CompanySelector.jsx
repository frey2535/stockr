import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Building2 } from 'lucide-react';

/**
 * CompanySelector Modal
 * 
 * Props:
 * - open: boolean - whether modal is shown
 * - onSelectCompany: function(companyId) - called when company selected
 * - onCancel: function - called when user dismisses
 */
export default function CompanySelector({ open, onSelectCompany, onCancel }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  // Fetch active companies on mount/open
  useEffect(() => {
    if (!open) return;
    
    const fetchCompanies = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await base44.entities.CompanyDirectory.filter({ is_active: true });
        setCompanies(result || []);
      } catch (err) {
        setError('Failed to load companies. Please try again.');
        console.error('CompanySelector fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [open]);

  const handleConfirm = () => {
    if (selectedId) {
      onSelectCompany(selectedId);
      setSelectedId(null);
    }
  };

  const handleCancel = () => {
    setSelectedId(null);
    onCancel?.();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Select Company
          </DialogTitle>
          <DialogDescription>
            Choose a company to manage. You can switch companies anytime by reopening this selector.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-secondary" />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {!loading && !error && companies.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              <p className="text-sm">No companies available.</p>
              <p className="text-xs mt-2">Contact your administrator.</p>
            </div>
          )}

          {!loading && !error && companies.length > 0 && (
            <div className="space-y-2">
              {companies.map((company) => (
                <Card
                  key={company.id}
                  className={`p-3 cursor-pointer transition-all ${
                    selectedId === company.company_id
                      ? 'ring-2 ring-secondary border-secondary bg-secondary/5'
                      : 'hover:border-secondary/50'
                  }`}
                  onClick={() => setSelectedId(company.company_id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 transition-colors ${
                        selectedId === company.company_id
                          ? 'border-secondary bg-secondary'
                          : 'border-muted-foreground'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{company.company_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{company.company_id}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
              onClick={handleConfirm}
              disabled={!selectedId || loading}
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}