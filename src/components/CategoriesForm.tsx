import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CheckboxIcon } from '@/components/icons';
import { Checkbox } from '@/components/ui/checkbox';

interface DraftSetupForm {
  participants: string[];
  categories: string[];
}

interface CategoriesFormProps {
  form: UseFormReturn<DraftSetupForm>;
  categories: string[];
}

const CategoryCheckbox = ({ 
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
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={id}
        checked={isChecked}
        onCheckedChange={onToggle}
        className="h-4 w-4"
      />
      <label
        htmlFor={id}
        className="text-sm font-medium leading-4 text-foreground font-brockmann cursor-pointer"
      >
        {category}
      </label>
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
      style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)', padding: '24px', gap: '24px'}}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex justify-center items-center" style={{ width: '24px', height: '24px', padding: '2px' }}>
          <CheckboxIcon className="text-primary" />
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
          gap: '16px',
          alignItems: 'start'
        }}
      >
        {categories.map((category) => (
          <CategoryCheckbox
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
