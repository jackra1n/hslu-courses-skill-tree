import studyProgrammes from './hslu_data/study_programmes.json';

type StudyProgramme = {
  ShortName: string;
  Name: string;
};

const PROGRAMME_DATA = (studyProgrammes.data ?? []) as StudyProgramme[];


export const PROGRAMS = PROGRAMME_DATA.map(program => program.Name);

export const PROGRAM_PLANS: Record<string, string[]> = {
  Informatik: ['HS16', 'HS25']
};
