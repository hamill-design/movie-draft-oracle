
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Users } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';

interface DraftSetupForm {
  participants: string[];
  categories: string[];
}

interface ParticipantsFormProps {
  form: UseFormReturn<DraftSetupForm>;
  draftSize: number;
}

const ParticipantsForm = ({ form, draftSize }: ParticipantsFormProps) => {
  return (
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
  );
};

export default ParticipantsForm;
