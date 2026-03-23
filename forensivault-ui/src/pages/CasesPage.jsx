import React from 'react';
import { useParams } from 'react-router-dom';
import CaseList from '../components/Cases/CaseList';
import CaseDetail from '../components/Cases/CaseDetail';

const CasesPage = () => {
  const { id } = useParams();

  if (id) {
    return <CaseDetail caseId={id} />;
  }

  return <CaseList />;
};

export default CasesPage;