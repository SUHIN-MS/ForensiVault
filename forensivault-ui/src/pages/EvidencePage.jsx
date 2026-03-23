import React from 'react';
import { useParams } from 'react-router-dom';
import EvidenceList from '../components/Evidence/EvidenceList';
import EvidenceDetail from '../components/Evidence/EvidenceDetail';

const EvidencePage = () => {
  const { id } = useParams();

  if (id) {
    return <EvidenceDetail evidenceId={id} />;
  }

  return <EvidenceList />;
};

export default EvidencePage;