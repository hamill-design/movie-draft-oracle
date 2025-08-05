
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

  const getCheckmarkStyle = () => {
    if (isChecked) {
      return {
        width: 9.33,
        height: 6.42,
        outline: '1.17px var(--UI-Primary, white) solid',
        outlineOffset: '-0.58px'
      };
    } else if (isHovered) {
      return {
        width: 9.33,
        height: 6.42,
        outline: '1.17px var(--Purple-300, #907AFF) solid',
        outlineOffset: '-0.58px'
      };
    }
    return null;
  };

  const checkmarkStyle = getCheckmarkStyle();

  return (
    <div 
      style={{
        width: '100%',
        height: '100%',
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 8,
        display: 'inline-flex'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onToggle(!isChecked)}
      className="cursor-pointer"
    >
      <div style={getCheckboxStyle()}>
        {checkmarkStyle && <div style={checkmarkStyle} />}
      </div>
      <div style={{
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        display: 'inline-flex'
      }}>
        <div style={{
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--Text-Primary, #2B2D2D)',
          fontSize: 14,
          fontFamily: 'Brockmann',
          fontWeight: '500',
          lineHeight: 20,
          wordWrap: 'break-word'
        }}>
          {category}
        </div>
      </div>
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
      className="w-full h-full p-6 bg-greyscale-blue-100 rounded-lg flex flex-col gap-6"
      style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)'}}
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
      
      {/* Categories Grid */}
      <div 
        className="self-stretch h-32"
        style={{
          display: 'grid',
          rowGap: '16px',
          columnGap: '16px',
          gridTemplateRows: 'repeat(4, minmax(0, 1fr))',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
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
