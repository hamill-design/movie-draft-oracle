
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowLeft, Users, CheckSquare } from 'lucide-react';
import { useForm } from 'react-hook-form';

interface DraftSetupForm {
  participants: string[];
  categories: string[];
}

const DraftSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const theme = searchParams.get('theme');
  const option = searchParams.get('option');
  const draftSize = parseInt(searchParams.get('draftSize') || '4');

  const form = useForm<DraftSetupForm>({
    defaultValues: {
      participants: Array(draftSize).fill(''),
      categories: []
    }
  });

  const yearCategories = [
    'Action/Adventure',
    'Animated',
    'Comedy',
    'Drama/Romance',
    'Sci-Fi/Fantasy',
    'Horror/Thriller',
    'Academy Award Nominee or Winner',
    'Blockbuster (minimum of $50 Mil)'
  ];

  const peopleCategories = [
    'Action/Adventure',
    'Animated',
    'Comedy',
    'Drama/Romance',
    'Sci-Fi/Fantasy',
    'Horror/Thriller',
    "80's",
    "90's",
    "2000's",
    "2010's",
    "2020's",
    'Academy Award Nominee or Winner',
    'Blockbuster (minimum of $50 Mil)'
  ];

  const categories = theme === 'year' ? yearCategories : peopleCategories;

  const handleBack = () => {
    navigate('/');
  };

  const onSubmit = (data: DraftSetupForm) => {
    console.log('Draft setup data:', data);
    // Here we would typically save the data and navigate to the actual draft page
    navigate('/draft', { 
      state: { 
        theme, 
        option, 
        participants: data.participants.filter(name => name.trim() !== ''),
        categories: data.categories 
      } 
    });
  };

  const handleCategoryToggle = (category: string, checked: boolean) => {
    const currentCategories = form.getValues('categories');
    if (checked) {
      form.setValue('categories', [...currentCategories, category]);
    } else {
      form.setValue('categories', currentCategories.filter(c => c !== category));
    }
  };

  if (!theme || !option) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={handleBack}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-white">Draft Setup</h1>
        </div>

        {/* Theme Info */}
        <Card className="bg-gray-800 border-gray-600 mb-8">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-300">
                Theme: <span className="text-yellow-400 font-bold capitalize">{theme}</span>
              </p>
              <p className="text-gray-300">
                Selection: <span className="text-yellow-400 font-bold">{option}</span>
              </p>
              <p className="text-gray-300">
                Draft Size: <span className="text-yellow-400 font-bold">{draftSize} people</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Participants Section */}
            <Card className="bg-gray-800 border-gray-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="text-yellow-400" size={24} />
                  Participant Names
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: draftSize }, (_, index) => (
                  <FormField
                    key={index}
                    control={form.control}
                    name={`participants.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">
                          Person {index + 1}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={`Enter name for person ${index + 1}`}
                            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Categories Section */}
            <Card className="bg-gray-800 border-gray-600">
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

            {/* Submit Button */}
            <div className="text-center">
              <Button
                type="submit"
                className="bg-yellow-400 text-black hover:bg-yellow-500 font-semibold"
                size="lg"
              >
                Start Draft
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default DraftSetup;
