import React, { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxIcon } from '@/components/icons';

interface DraftSetupForm {
  participants: string[];
  categories: string[];
}

interface CategoriesFormProps {
  form: UseFormReturn<DraftSetupForm>;
  categories: string[];
}

const CustomCheckbox = ({ 
  id, 
  category, 
  isChecked, 
  onToggle 
}: { 
  id: string; 
  category: string; 
  isChecked: boolean; 
  onToggle: (checked: boolean) => void; 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getCheckboxStyle = () => {
    if (isChecked) {
      return {
        width: 16,
        height: 16,
        background: isHovered ? 'var(--Purple-400, #7B42FF)' : 'var(--Brand-Primary, #680AFF)',
        borderRadius: 4,
        outline: '1px var(--Purple-300, #907AFF) solid',
        outlineOffset: '-1px',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        display: 'flex'
      };
    } else {
      return {
        width: 16,
        height: 16,
        borderRadius: 4,
        outline: '1px var(--Purple-300, #907AFF) solid',
        outlineOffset: '-1px',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        display: 'flex'
      };
    }
  };

  const getCheckmarkElement = () => {
    if (isChecked || isHovered) {
      const strokeColor = isChecked ? 'white' : 'var(--Purple-300, #907AFF)';
      return (
        <svg width="9.33" height="6.42" viewBox="0 0 12 8" fill="none">
          <path 
            d="M10.6667 0.791687L4.25 7.20835L1.33333 4.29169" 
            stroke={strokeColor} 
            strokeWidth="1.16667" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    return null;
  };

  const checkmarkElement = getCheckmarkElement();

  return (
    <div 
      className="cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onToggle(!isChecked)}
      style={{
        width: '100%',
        height: 32,
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 8,
        display: 'flex'
      }}
    >
      <div style={getCheckboxStyle()}>
        {checkmarkElement}
      </div>
      <span style={{
        color: 'var(--Text-Primary, #2B2D2D)',
        fontSize: 14,
        fontFamily: 'Brockmann',
        fontWeight: '500',
        lineHeight: '16px',
        margin: 0,
        padding: 0
      }}>
        {category}
      </span>
    </div>
  );
};

const CategoriesForm = ({ form, categories }: CategoriesFormProps) => {
  const handleCategoryToggle = (category: string, checked: boolean) => {
    const currentCategories = form.getValues('categories');
    if (checked) {
      form.setValue('categories', [...currentCategories, category]);
    } else {
      form.setValue('categories', currentCategories.filter(c => c !== category));
    }
  };

  const selectedCategories = form.watch('categories') || [];

  return (
    <div 
      className="w-full bg-greyscale-blue-100 rounded-lg flex flex-col"
      style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)', padding: '16px', gap: '12px'}}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 p-0.5 flex justify-center items-center">
          <CheckboxIcon className="w-5 h-5 text-primary" />
        </div>
        <span className="text-foreground text-xl font-brockmann font-medium leading-7">
          Choose Categories
        </span>
      </div>
      
      {/* Categories List */}
      <div 
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2px',
          alignItems: 'start'
        }}
      >
        {categories.map((category) => (
          <CustomCheckbox
            key={category}
            id={category}
            category={category}
            isChecked={selectedCategories.includes(category)}
            onToggle={(checked) => handleCategoryToggle(category, checked)}
          />
        ))}
      </div>
    </div>
  );
};

export default CategoriesForm;
