'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { getClothingItems, createClothingItem, updateClothingItem, deleteClothingItem } from '@/actions/wardrobe';
import { type ClothingItem, type ClothingCategory } from '@/lib/schema';
import { getCategoryLabel } from '@/lib/outfit';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Edit2, Trash2, Plus, X, Shirt, Check } from 'lucide-react';

// Group categories by type
const CATEGORY_GROUPS = [
  {
    name: 'Tops',
    categories: ['top_short_sleeve', 'top_long_sleeve_thin', 'top_long_sleeve_standard', 'top_long_sleeve_warm'],
  },
  {
    name: 'Outerwear',
    categories: ['outer_quarter_zip', 'outer_shell', 'outer_hoodie'],
  },
  {
    name: 'Bottoms',
    categories: ['bottom_shorts', 'bottom_half_tights', 'bottom_leggings'],
  },
  {
    name: 'Accessories',
    categories: ['gloves_thin', 'gloves_medium', 'gloves_winter', 'beanie', 'buff'],
  },
  {
    name: 'Socks',
    categories: ['socks_thin', 'socks_warm'],
  },
] as const;

// Default warmth rating for each category
const DEFAULT_WARMTH: Record<string, number> = {
  top_short_sleeve: 1,
  top_long_sleeve_thin: 2,
  top_long_sleeve_standard: 3,
  top_long_sleeve_warm: 4,
  outer_quarter_zip: 3,
  outer_shell: 3,
  outer_hoodie: 4,
  bottom_shorts: 1,
  bottom_half_tights: 2,
  bottom_leggings: 4,
  gloves_thin: 2,
  gloves_medium: 3,
  gloves_winter: 5,
  beanie: 4,
  buff: 3,
  socks_thin: 1,
  socks_warm: 3,
  other: 3,
};

export default function WardrobePage() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  const [modalCategory, setModalCategory] = useState<ClothingCategory>('top_short_sleeve');
  const [isPending, startTransition] = useTransition();

  // Form state
  const [name, setName] = useState('');
  const [warmthRating, setWarmthRating] = useState(3);
  const [notes, setNotes] = useState('');

  const loadItems = useCallback(async () => {
    const data = await getClothingItems(true); // Load all including inactive
    setItems(data);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Get items for a category
  const getItemsForCategory = (category: string) => {
    return items.filter(item => item.category === category && item.isActive);
  };

  // Check if user owns any items in a category
  const hasCategory = (category: string) => {
    return getItemsForCategory(category).length > 0;
  };

  // Toggle category ownership
  const toggleCategory = (category: ClothingCategory) => {
    startTransition(async () => {
      if (hasCategory(category)) {
        // Remove all items in this category (mark inactive or delete)
        const categoryItems = getItemsForCategory(category);
        for (const item of categoryItems) {
          await deleteClothingItem(item.id);
        }
      } else {
        // Create a placeholder item for this category
        await createClothingItem({
          name: getCategoryLabel(category),
          category,
          warmthRating: DEFAULT_WARMTH[category] || 3,
          notes: '',
        });
      }
      await loadItems();
    });
  };

  // Toggle expanded state for a category
  const toggleExpanded = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Open modal to add item to a category
  const openAddModal = (category: ClothingCategory) => {
    setEditingItem(null);
    setModalCategory(category);
    setName('');
    setWarmthRating(DEFAULT_WARMTH[category] || 3);
    setNotes('');
    setIsModalOpen(true);
  };

  // Open modal to edit an item
  const openEditModal = (item: ClothingItem) => {
    setEditingItem(item);
    setModalCategory(item.category as ClothingCategory);
    setName(item.name);
    setWarmthRating(item.warmthRating);
    setNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      if (editingItem) {
        await updateClothingItem(editingItem.id, {
          name,
          category: modalCategory,
          warmthRating,
          notes,
        });
      } else {
        await createClothingItem({
          name,
          category: modalCategory,
          warmthRating,
          notes,
        });
      }
      setIsModalOpen(false);
      await loadItems();
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm('Delete this item?')) return;
    startTransition(async () => {
      await deleteClothingItem(id);
      await loadItems();
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">My Wardrobe</h1>
        <p className="text-sm text-slate-500 mt-1">
          Check the gear you own for personalized outfit recommendations
        </p>
      </div>

      <div className="space-y-6">
        {CATEGORY_GROUPS.map(group => (
          <div key={group.name} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h2 className="font-medium text-slate-900">{group.name}</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {group.categories.map(category => {
                const owned = hasCategory(category);
                const categoryItems = getItemsForCategory(category);
                const isExpanded = expandedCategories.has(category);

                return (
                  <div key={category}>
                    <div className="px-4 py-3 flex items-center gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleCategory(category as ClothingCategory)}
                        disabled={isPending}
                        className={cn(
                          'w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors',
                          owned
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 hover:border-slate-400'
                        )}
                      >
                        {owned && <Check className="w-4 h-4" />}
                      </button>

                      {/* Label */}
                      <span
                        className={cn(
                          'flex-1 font-medium transition-colors',
                          owned ? 'text-slate-900' : 'text-slate-500'
                        )}
                      >
                        {getCategoryLabel(category as ClothingCategory)}
                      </span>

                      {/* Item count & expand button */}
                      {owned && (
                        <button
                          onClick={() => toggleExpanded(category)}
                          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                        >
                          <span>{categoryItems.length} item{categoryItems.length !== 1 ? 's' : ''}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Expanded items */}
                    {owned && isExpanded && (
                      <div className="px-4 pb-3 ml-9">
                        <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                          {categoryItems.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200"
                            >
                              <div>
                                <span className="font-medium text-slate-900">{item.name}</span>
                                <span className="text-sm text-slate-500 ml-2">
                                  (Warmth: {item.warmthRating}/5)
                                </span>
                                {item.notes && (
                                  <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => openAddModal(category as ClothingCategory)}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 px-3 py-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add another {getCategoryLabel(category as ClothingCategory).toLowerCase()}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="mt-6 bg-blue-50 rounded-xl p-4">
        <div className="flex items-center gap-2 text-blue-800">
          <Shirt className="w-5 h-5" />
          <span className="font-medium">
            {items.filter(i => i.isActive).length} items across{' '}
            {new Set(items.filter(i => i.isActive).map(i => i.category)).size} categories
          </span>
        </div>
        <p className="text-sm text-blue-600 mt-1">
          The more gear you add, the better your outfit recommendations will be!
        </p>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingItem ? 'Edit Item' : `Add ${getCategoryLabel(modalCategory)}`}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`My ${getCategoryLabel(modalCategory).toLowerCase()}`}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Warmth Rating (1-5)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setWarmthRating(rating)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                        warmthRating === rating
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      )}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  1 = Lightest, 5 = Warmest
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Good for windy days"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : editingItem ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
