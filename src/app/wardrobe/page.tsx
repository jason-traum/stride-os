'use client';

import { useState, useEffect, useTransition } from 'react';
import { getClothingItems, createClothingItem, updateClothingItem, deleteClothingItem, toggleClothingItemActive } from '@/actions/wardrobe';
import { clothingCategories, type ClothingItem, type ClothingCategory } from '@/lib/schema';
import { getCategoryLabel, getCategoryGroup } from '@/lib/outfit';
import { cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, X, Shirt, ThermometerSun } from 'lucide-react';

export default function WardrobePage() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClothingCategory>('top_short_sleeve');
  const [warmthRating, setWarmthRating] = useState(3);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadItems();
  }, [showInactive]);

  const loadItems = async () => {
    const data = await getClothingItems(showInactive);
    setItems(data);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setCategory('top_short_sleeve');
    setWarmthRating(3);
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: ClothingItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category as ClothingCategory);
    setWarmthRating(item.warmthRating);
    setNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      if (editingItem) {
        await updateClothingItem(editingItem.id, { name, category, warmthRating, notes });
      } else {
        await createClothingItem({ name, category, warmthRating, notes });
      }
      setIsModalOpen(false);
      loadItems();
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm('Delete this item?')) return;
    startTransition(async () => {
      await deleteClothingItem(id);
      loadItems();
    });
  };

  const handleToggleActive = (id: number) => {
    startTransition(async () => {
      await toggleClothingItemActive(id);
      loadItems();
    });
  };

  // Group items by category group
  const groupedItems = items.reduce((acc, item) => {
    const group = getCategoryGroup(item.category as ClothingCategory);
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, ClothingItem[]>);

  const groupOrder = ['Tops', 'Outerwear', 'Bottoms', 'Gloves', 'Headwear', 'Socks', 'Other'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Wardrobe</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your running gear for outfit recommendations</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show inactive items
        </label>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <Shirt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-slate-900 mb-2">No items yet</h2>
          <p className="text-slate-500 mb-4">Add your running gear to get outfit recommendations.</p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add your first item
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupOrder.map(group => {
            const groupItems = groupedItems[group];
            if (!groupItems || groupItems.length === 0) return null;

            return (
              <div key={group} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h2 className="font-medium text-slate-900">{group}</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {groupItems.map(item => (
                    <div
                      key={item.id}
                      className={cn(
                        'px-4 py-3 flex items-center justify-between',
                        !item.isActive && 'opacity-50'
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{item.name}</span>
                          {!item.isActive && (
                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                          <span>{getCategoryLabel(item.category as ClothingCategory)}</span>
                          <span className="flex items-center gap-1">
                            <ThermometerSun className="w-3.5 h-3.5" />
                            Warmth: {item.warmthRating}/5
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-slate-400 mt-1">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(item.id)}
                          className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        >
                          {item.isActive ? 'Deactivate' : 'Activate'}
                        </button>
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
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                {editingItem ? 'Edit Item' : 'Add Item'}
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
                  placeholder="Blue quarter zip"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ClothingCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {clothingCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {getCategoryLabel(cat)}
                    </option>
                  ))}
                </select>
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
