import idmsData from './idms-json-dump_h25_processed.json';
import type { Course, IdmsPrerequisiteRule, ModuleType } from './courses';

interface IdmsModule {
  Name: string;
  NameEnglish: string;
  ShortName: string;
  Ects: number;
  ModuleOffers: Array<{
    Department: string;
    DegreeProgramme: string;
    ModuleType: string;
    CourseOffering: string;
    OfferedToClasses: string[];
  }>;
  Prerequisites: Array<{
    Modules: string[];
    MustBePassed: boolean;
    ModuleLinkType: "und" | "oder";
    PrerequisiteLinkType?: "und" | "oder";
  }> | null;
  PrerequisiteNote: string | null;
}

interface IdmsData {
  Modules: IdmsModule[];
  MajorMinors: any[];
}

function mapModuleType(idmsType: string): ModuleType {
  switch (idmsType) {
    case "Kernmodul": return "Kernmodul";
    case "Projektmodul": return "Projektmodul";
    case "Erweiterungsmodul": return "Erweiterungsmodul";
    case "Major-/Minormodul": return "Major-/Minormodul";
    case "Zusatzmodul": return "Zusatzmodul";
    default: return "Erweiterungsmodul"; // fallback
  }
}

function mapPrerequisites(idmsPrereqs: IdmsModule['Prerequisites']): IdmsPrerequisiteRule[] {
  if (!idmsPrereqs) return [];
  
  return idmsPrereqs.map(rule => ({
    modules: rule.Modules,
    mustBePassed: rule.MustBePassed,
    moduleLinkType: rule.ModuleLinkType,
    prerequisiteLinkType: rule.PrerequisiteLinkType
  }));
}

function selectModuleType(moduleOffers: IdmsModule['ModuleOffers'], plan: string): ModuleType | undefined {
  // filter to Informatik program
  const informatikOffers = moduleOffers.filter(offer => 
    offer.DegreeProgramme === "Informatik"
  );
  
  if (informatikOffers.length === 0) {
    // fallback to first offer if no Informatik offers
    return informatikOffers.length > 0 ? mapModuleType(moduleOffers[0].ModuleType) : undefined;
  }
  
  // map plan to CourseOffering preference
  const preferredOffering = plan.startsWith('HS') ? 'Herbst' : 
                           plan.startsWith('FS') ? 'Frühling' : 'Frühling/Herbst';
  
  // try to find offer matching preferred offering
  const preferredOffer = informatikOffers.find(offer => 
    offer.CourseOffering === preferredOffering
  );
  
  if (preferredOffer) {
    return mapModuleType(preferredOffer.ModuleType);
  }
  
  // try Frühling/Herbst as fallback
  const flexibleOffer = informatikOffers.find(offer => 
    offer.CourseOffering === 'Frühling/Herbst'
  );
  
  if (flexibleOffer) {
    return mapModuleType(flexibleOffer.ModuleType);
  }
  
  // use first available offer
  return mapModuleType(informatikOffers[0].ModuleType);
}

export function loadIdmsCourses(plan: string = 'HS25'): Course[] {
  const data = idmsData as IdmsData;
  
  return data.Modules.map(module => ({
    id: module.ShortName,
    label: module.NameEnglish,
    ects: module.Ects,
    prerequisites: mapPrerequisites(module.Prerequisites),
    prerequisiteNote: module.PrerequisiteNote || undefined,
    type: selectModuleType(module.ModuleOffers, plan)
  }));
}
