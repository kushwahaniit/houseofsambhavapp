import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, MoreVertical } from 'lucide-react';

interface DropdownItem {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface DropdownProps {
  label?: string;
  icon?: React.ElementType;
  items: DropdownItem[];
  variant?: 'primary' | 'secondary' | 'ghost';
  align?: 'left' | 'right';
  hideChevron?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({ 
  label, 
  icon: Icon, 
  items, 
  variant = 'secondary',
  align = 'right',
  hideChevron = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-amber-700 text-white hover:bg-amber-800';
      case 'ghost':
        return 'bg-transparent text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800';
      default:
        return 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700';
    }
  };

  const isIconOnly = !label && (Icon || !label);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 transition-all ${
          isIconOnly ? 'p-2 rounded-full' : 'px-4 py-2.5 rounded-xl font-medium'
        } ${getVariantClasses()}`}
      >
        {Icon ? <Icon size={18} /> : (!label && <MoreVertical size={18} />)}
        {label && <span>{label}</span>}
        {!hideChevron && label && (
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && (
        <div className={`absolute top-full mt-2 w-56 bg-white dark:bg-stone-900 rounded-xl shadow-xl border border-stone-200 dark:border-stone-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors disabled:opacity-50 ${
                item.variant === 'danger' 
                  ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20' 
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              {item.icon && <item.icon size={16} />}
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
