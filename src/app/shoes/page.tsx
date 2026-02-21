'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { getAllShoes, createShoe, retireShoe, unretireShoe } from '@/actions/shoes';
import { shoeCategories, shoeIntendedUseOptions } from '@/lib/schema';
import { cn } from '@/lib/utils';
import { Footprints, ChevronRight, X, Plus, Settings } from 'lucide-react';
import { useProfile } from '@/lib/profile-context';
import { ShoeDashboard } from '@/components/ShoeDashboard';
import { ShoeRotation } from '@/components/ShoeRotation';
import type { Shoe } from '@/lib/schema';

export default function ShoesPage() {
  const { activeProfile } = useProfile();
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showRetired, setShowRetired] = useState(false);

  const loadShoes = useCallback(async () => {
    const profileId = activeProfile?.id;
    const allShoes = await getAllShoes(profileId);
    setShoes(allShoes);
  }, [activeProfile?.id]);

  useEffect(() => {
    loadShoes();
  }, [loadShoes]);

  const activeShoes = shoes.filter((s) => !s.isRetired);
  const retiredShoes = shoes.filter((s) => s.isRetired);

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      daily_trainer: 'Daily Trainer',
      tempo: 'Tempo',
      race: 'Race',
      trail: 'Trail',
      recovery: 'Recovery',
    };
    return labels[cat] || cat;
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      daily_trainer: 'bg-sky-900/30 text-sky-300',
      tempo: 'bg-indigo-900/30 text-indigo-300',
      race: 'bg-amber-900/30 text-amber-300',
      trail: 'bg-bgTertiary text-textSecondary',
      recovery: 'bg-slate-800/40 text-slate-300',
    };
    return colors[cat] || 'bg-bgTertiary text-textSecondary';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-semibold text-primary">Shoes</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManage(!showManage)}
            className="inline-flex items-center gap-1.5 text-sm text-textTertiary hover:text-textSecondary transition-colors"
          >
            <Settings className="w-4 h-4" />
            Manage
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary inline-flex items-center gap-2 text-sm rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Add Shoe
          </button>
        </div>
      </div>

      {/* Shoe Mileage Dashboard */}
      <div className="mb-6">
        <ShoeDashboard />
      </div>

      {/* Shoe Rotation Analysis */}
      <div className="mb-6">
        <ShoeRotation />
      </div>

      {/* Manage Shoes (collapsible) */}
      {showManage && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-textSecondary mb-3">Manage Shoes</h2>

          {/* Active Shoes */}
          {activeShoes.length === 0 ? (
            <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-8 text-center mb-4 shadow-sm">
              <div className="text-tertiary mb-4">
                <Footprints className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-primary mb-2">No shoes yet</h3>
              <p className="text-textTertiary mb-4">Add your running shoes to track their mileage.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary inline-flex items-center text-sm rounded-xl"
              >
                Add your first shoe
              </button>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {activeShoes.map((shoe) => (
                <ManageShoeCard
                  key={shoe.id}
                  shoe={shoe}
                  getCategoryLabel={getCategoryLabel}
                  getCategoryColor={getCategoryColor}
                  onRetire={async () => {
                    await retireShoe(shoe.id);
                    loadShoes();
                  }}
                />
              ))}
            </div>
          )}

          {/* Retired Shoes */}
          {retiredShoes.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowRetired(!showRetired)}
                className="flex items-center gap-2 text-sm text-textTertiary hover:text-secondary mb-3"
              >
                <ChevronRight
                  className={cn('w-4 h-4 transition-transform', showRetired && 'rotate-90')}
                />
                Retired Shoes ({retiredShoes.length})
              </button>

              {showRetired && (
                <div className="space-y-2 opacity-60">
                  {retiredShoes.map((shoe) => (
                    <ManageShoeCard
                      key={shoe.id}
                      shoe={shoe}
                      getCategoryLabel={getCategoryLabel}
                      getCategoryColor={getCategoryColor}
                      onUnretire={async () => {
                        await unretireShoe(shoe.id);
                        loadShoes();
                      }}
                      isRetired
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Shoe Modal */}
      {showAddModal && (
        <AddShoeModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadShoes();
          }}
          profileId={activeProfile?.id}
        />
      )}
    </div>
  );
}

function ManageShoeCard({
  shoe,
  getCategoryLabel,
  getCategoryColor,
  onRetire,
  onUnretire,
  isRetired,
}: {
  shoe: Shoe;
  getCategoryLabel: (cat: string) => string;
  getCategoryColor: (cat: string) => string;
  onRetire?: () => void;
  onUnretire?: () => void;
  isRetired?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const handleAction = () => {
    startTransition(async () => {
      if (isRetired && onUnretire) {
        await onUnretire();
      } else if (onRetire) {
        await onRetire();
      }
    });
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-medium text-textPrimary text-sm truncate">{shoe.name}</h3>
          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getCategoryColor(shoe.category)} whitespace-nowrap`}>
            {getCategoryLabel(shoe.category)}
          </span>
          <span className="text-xs text-textTertiary whitespace-nowrap">
            {shoe.totalMiles.toFixed(0)} mi
          </span>
        </div>
        <button
          onClick={handleAction}
          disabled={isPending}
          className={cn(
            'text-xs font-medium disabled:opacity-50 whitespace-nowrap ml-2',
            isRetired
              ? 'text-dream-500 hover:text-dream-400'
              : 'text-textTertiary hover:text-textSecondary'
          )}
        >
          {isPending ? '...' : isRetired ? 'Unretire' : 'Retire'}
        </button>
      </div>
    </div>
  );
}

function AddShoeModal({
  onClose,
  onSuccess,
  profileId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  profileId?: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState<string>('daily_trainer');
  const [intendedUse, setIntendedUse] = useState<string[]>([]);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const toggleIntendedUse = (use: string) => {
    if (intendedUse.includes(use)) {
      setIntendedUse(intendedUse.filter((u) => u !== use));
    } else {
      setIntendedUse([...intendedUse, use]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name || !brand || !model) {
      setValidationError('Please fill in nickname, brand, and model');
      return;
    }

    startTransition(async () => {
      await createShoe({
        name,
        brand,
        model,
        category,
        intendedUse,
        purchaseDate: purchaseDate || undefined,
        notes: notes || undefined,
        profileId,
      });
      onSuccess();
    });
  };

  const categoryLabels: Record<string, string> = {
    daily_trainer: 'Daily Trainer',
    tempo: 'Tempo',
    race: 'Race',
    trail: 'Trail',
    recovery: 'Recovery',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bgSecondary rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-borderPrimary">
        <div className="sticky top-0 bg-bgSecondary border-b border-borderPrimary px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-textPrimary">Add Shoe</h2>
            <button onClick={onClose} className="text-textTertiary hover:text-textSecondary">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">
              Nickname *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Trainers, Race Flats"
              className="w-full px-3 py-2 bg-bgPrimary border border-borderPrimary rounded-lg text-textPrimary placeholder:text-textTertiary focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Brand *</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Nike"
                className="w-full px-3 py-2 bg-bgPrimary border border-borderPrimary rounded-lg text-textPrimary placeholder:text-textTertiary focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Model *</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g., Pegasus 40"
                className="w-full px-3 py-2 bg-bgPrimary border border-borderPrimary rounded-lg text-textPrimary placeholder:text-textTertiary focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-textSecondary mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {shoeCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                    category === cat
                      ? 'bg-dream-600 text-white'
                      : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                  )}
                >
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-textSecondary mb-2">Intended Use</label>
            <div className="flex flex-wrap gap-2">
              {shoeIntendedUseOptions.map((use) => (
                <button
                  key={use}
                  type="button"
                  onClick={() => toggleIntendedUse(use)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize',
                    intendedUse.includes(use)
                      ? 'bg-dream-600 text-white'
                      : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                  )}
                >
                  {use}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">
              Purchase Date (optional)
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2 bg-bgPrimary border border-borderPrimary rounded-lg text-textPrimary focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this shoe..."
              rows={2}
              className="w-full px-3 py-2 bg-bgPrimary border border-borderPrimary rounded-lg text-textPrimary placeholder:text-textTertiary focus:ring-2 focus:ring-dream-500 focus:border-dream-500 resize-none"
            />
          </div>

          {validationError && (
            <p className="text-sm text-red-400 bg-red-950/50 px-3 py-2 rounded-lg">{validationError}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className={cn(
              'w-full py-3 px-4 rounded-xl font-medium transition-colors',
              isPending
                ? 'bg-bgTertiary text-textTertiary cursor-not-allowed'
                : 'bg-dream-600 text-white hover:bg-dream-700'
            )}
          >
            {isPending ? 'Adding...' : 'Add Shoe'}
          </button>
        </form>
      </div>
    </div>
  );
}
