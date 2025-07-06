import React from 'react';
import { Button } from "@/components/ui/Button";

const CTASection = () => {
  return (
    <section className="py-20 bg-background text-black relative overflow-hidden">
  
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-primary">Want to Help the NHS? Help Yourself</h2>
          <p className="text-xl mb-8 text-gray-600">
            Healthcare systems around the world, like the NHS, are struggling with the massive burden of health documentation. By managing your own record, you can reduce this burden, make better decisions for your health, contribute to research, benefit financially, and more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="px-8 text-lg">
              Get Started Free
            </Button>
            <Button size="lg" variant="outline" className="px-8 text-lg">
              Learn More
            </Button>
          </div>
          <p className="mt-6 text-sm text-health-100">No payment required. Managing your record is free and always will be.</p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;