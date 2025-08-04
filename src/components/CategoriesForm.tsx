
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckSquare } from 'lucide-react';
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
    <Card className="bg-greyscale-blue-100">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <CheckSquare className="text-yellow-400" size={24} />
          Select Categories
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((category) => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox
                id={category}
                onCheckedChange={(checked) => handleCategoryToggle(category, checked as boolean)}
                className="border-gray-400"
              />
              <label
                htmlFor={category}
                className="text-gray-300 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {category}
              </label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CategoriesForm;
