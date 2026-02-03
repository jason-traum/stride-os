'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { getAllShoes, createShoe, retireShoe, unretireShoe } from '@/actions/shoes';
import { shoeCategories, shoeIntendedUseOptions } from '@/lib/schema';
import { cn } from '@/lib/utils';
import { Footprints, ChevronRight, X, Plus } from 'lucide-react';
import { useProfile } from '@/lib/profile-context';
import type { Shoe } from '@/lib/schema';

export default function ShoesPage() {
  const { activeProfile } = useProfile();
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
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
      daily_trainer: 'bg-blue-100 text-blue-800',
      tempo: 'bg-orange-100 text-orange-800',
      race: 'bg-red-100 text-red-800',
      trail: 'bg-green-100 text-green-800',
      recovery: 'bg-teal-100 text-teal-800',
    };
    return colors[cat] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-semibold text-slate-900">Shoes</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Shoe
        </button>
      </div>

      {/* Active Shoes */}
      {activeShoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center mb-6 shadow-sm">
          <div className="text-slate-300 mb-4">
            <Footprints className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-lg font-medium text-slate-900 mb-2">No shoes yet</h2>
          <p className="text-slate-500 mb-4">Add your running shoes to track their mileage.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Add your first shoe
          </button>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {activeShoes.map((shoe) => (
            <ShoeCard
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
        <div className="mt-8">
          <button
            onClick={() => setShowRetired(!showRetired)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-3"
          >
            <ChevronRight
              className={cn('w-4 h-4 transition-transform', showRetired && 'rotate-90')}
            />
            Retired Shoes ({retiredShoes.length})
          </button>

          {showRetired && (
            <div className="space-y-3 opacity-60">
              {retiredShoes.map((shoe) => (
                <ShoeCard
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

function ShoeCard({
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
  const intendedUse = JSON.parse(shoe.intendedUse || '[]');

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
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-slate-900">{shoe.name}</h3>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(shoe.category)}`}>
              {getCategoryLabel(shoe.category)}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {shoe.brand} {shoe.model}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm font-medium text-slate-900">
              {shoe.totalMiles.toFixed(1)} miles
            </span>
            {intendedUse.length > 0 && (
              <div className="flex gap-1">
                {intendedUse.map((use: string) => (
                  <span key={use} className="text-xs text-slate-400 capitalize">
                    {use}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleAction}
          disabled={isPending}
          className={cn(
            'text-sm font-medium disabled:opacity-50',
            isRetired
              ? 'text-blue-600 hover:text-blue-700'
              : 'text-slate-400 hover:text-slate-600'
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
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Add Shoe</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nickname *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Trainers, Race Flats"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Brand *</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Nike"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model *</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g., Pegasus 40"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {shoeCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                    category === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Intended Use</label>
            <div className="flex flex-wrap gap-2">
              {shoeIntendedUseOptions.map((use) => (
                <button
                  key={use}
                  type="button"
                  onClick={() => toggleIntendedUse(use)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize',
                    intendedUse.includes(use)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {use}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Purchase Date (optional)
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this shoe..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {validationError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{validationError}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className={cn(
              'w-full py-3 px-4 rounded-xl font-medium transition-colors',
              isPending
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            {isPending ? 'Adding...' : 'Add Shoe'}
          </button>
        </form>
      </div>
    </div>
  );
}
