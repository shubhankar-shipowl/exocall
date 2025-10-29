import React from "react";
import CallTable from "../components/CallTable";
import ErrorBoundary from "../components/ErrorBoundary";

const CallTablePage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Call Management</h1>
          <p className="mt-2 text-lg text-gray-600">
            Manage your contacts and initiate calls with live status updates
          </p>
        </div>

        {/* Call Table Component */}
        <ErrorBoundary>
          <CallTable />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default CallTablePage;
