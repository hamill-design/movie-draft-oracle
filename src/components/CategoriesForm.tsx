
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { UseFormReturn } from 'react-hook-form';

interface DraftSetupForm {
  participants: string[];
  categories: string[];
}

interface CategoriesFormProps {
  form: UseFormReturn<DraftSetupForm>;
  categories: string[];
}

const CategoriesForm = ({ form, categories }: CategoriesFormProps) => {
  const handleCategoryToggle = (category: string, checked: boolean) => {
    const currentCategories = form.getValues('categories');
    if (checked) {
      form.setValue('categories', [...currentCategories, category]);
    } else {
      form.setValue('categories', currentCategories.filter(c => c !== category));
    }
  };

  return (
    <div 
      className="w-full h-full p-6 bg-greyscale-blue-100 rounded-lg flex flex-col gap-6"
      style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)'}}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 p-0.5 flex justify-center items-center">
          <div className="w-5 h-5 bg-primary"></div>
        </div>
        <span className="text-foreground text-xl font-brockmann font-medium leading-7">
          Choose Categories
        </span>
      </div>
      
      {/* Categories Grid */}
      <div className="flex flex-col gap-0">
        {categories.map((category) => (
          <div key={category} className="w-full flex items-center gap-2">
            <Checkbox
              id={category}
              onCheckedChange={(checked) => handleCategoryToggle(category, checked as boolean)}
              className="w-4 h-4 rounded border border-purple-300 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
            />
            <label
              htmlFor={category}
              className="text-foreground text-sm font-brockmann font-medium leading-5 cursor-pointer"
            >
              {category}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoriesForm;
