
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import DraftInfo from '@/components/DraftInfo';
import ParticipantsForm from '@/components/ParticipantsForm';
import CategoriesForm from '@/components/CategoriesForm';
import { useDraftCategories } from '@/hooks/useDraftCategories';

interface DraftSetupForm {
  participants: string[];
  categories: string[];
}

interface DraftState {
  theme: string;
  option: string;
  participants: string[];
  draftSize: number;
}

const DraftSetup = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const draftState = location.state as DraftState;
  
  // If no draft state, redirect to home
  if (!draftState) {
    navigate('/');
    return null;
  }

  const { theme, option, participants, draftSize } = draftState;

  const form = useForm<DraftSetupForm>({
    defaultValues: {
      participants: participants || Array(draftSize).fill(''),
      categories: []
    }
  });

  const categories = useDraftCategories(theme);

  const handleBack = () => {
    navigate('/');
  };

  const onSubmit = (data: DraftSetupForm) => {
    console.log('Draft setup data:', data);
    navigate('/draft', { 
      state: { 
        theme, 
        option, 
        participants: data.participants.filter(name => name.trim() !== ''),
        categories: data.categories 
      } 
    });
  };

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

        <DraftInfo theme={theme} option={option} draftSize={draftSize} />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <ParticipantsForm form={form} draftSize={draftSize} />
            <CategoriesForm form={form} categories={categories} />

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
