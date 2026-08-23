import { useState, useMemo } from 'react';
import { useApp } from '@/app/AppContext';

export function useSkillsViewModel() {
  const { skills, toggleSkill } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(skills.map(s => s.category));
    return ['all', ...Array.from(set)];
  }, [skills]);

  const filteredSkills = useMemo(() => {
    return skills.filter(skill => {
      const matchesSearch =
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [skills, searchQuery, selectedCategory]);

  const selectedSkill = useMemo(() => {
    return skills.find(s => s.id === selectedSkillId) || null;
  }, [skills, selectedSkillId]);

  const handleToggleSkill = (id: string) => {
    toggleSkill(id);
  };

  const handleScanMcp = async () => {
    setIsScanning(true);
    try {
      await new Promise(r => setTimeout(r, 1200));
    } finally {
      setIsScanning(false);
    }
  };

  return {
    skills,
    filteredSkills,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    selectedSkill,
    selectedSkillId,
    setSelectedSkillId,
    isScanning,
    handleToggleSkill,
    handleScanMcp
  };
}
