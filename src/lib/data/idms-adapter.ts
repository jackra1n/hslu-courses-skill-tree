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
  const informatikOffers = moduleOffers.filter(offer => 
    offer.DegreeProgramme === "Informatik"
  );
  
  // map plan to CourseOffering preference
  const preferredOffering = plan.startsWith('HS') ? 'Herbst' : 
                           plan.startsWith('FS') ? 'Frühling' : 'Frühling/Herbst';
  
  // helper function to find best offer from a list
  const findBestOffer = (offers: IdmsModule['ModuleOffers']) => {
    // try preferred offering first
    const preferredOffer = offers.find(offer => 
      offer.CourseOffering === preferredOffering
    );
    if (preferredOffer) return preferredOffer;
    
    // try Frühling/Herbst as fallback
    const flexibleOffer = offers.find(offer => 
      offer.CourseOffering === 'Frühling/Herbst'
    );
    if (flexibleOffer) return flexibleOffer;
    
    // use first available offer
    return offers[0];
  };
  
  // prioritize Informatik offers, but fall back to all offers if none exist
  const baseOffers = informatikOffers.length > 0 ? informatikOffers : moduleOffers;
  const bestOffer = baseOffers.length > 0 ? findBestOffer(baseOffers) : undefined;
  
  return bestOffer ? mapModuleType(bestOffer.ModuleType) : undefined;
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
