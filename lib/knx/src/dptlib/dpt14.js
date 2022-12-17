/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

const log = require('log-driver').logger;

//
// DPT14.*: 4-byte floating point value
//

/* In sharp contrast to DPT9 (16-bit floating point - JS spec does not support),
 *  the case for 32-bit floating point is simple...
 */

exports.formatAPDU = (value) => {
  if (value == null || typeof value != 'number')
    log.error('DPT14: Must supply a number value');
  const apdu_data = Buffer.alloc(4);
  apdu_data.writeFloatBE(value, 0);
  return apdu_data;
};

exports.fromBuffer = (buf) => {
  if (buf.length != 4) log.warn('DPT14: Buffer should be 4 bytes long');
  return buf.readFloatBE(0);
};

// DPT14 base type info
exports.basetype = {
  bitlength: 32,
  valuetype: 'basic',
  range: [0, Math.pow(2, 32)],
  desc: '32-bit floating point value',
};

// DPT14 subtypes info
exports.subtypes = {
  '000': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Acceleration',  //Name
    desc: 'acceleration', //Encoding field1
    unit: 'ms-2',
  },

  '001': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Acceleration_Angular',  //Name
    desc: 'acceleration, angular', //Encoding field1
    unit: 'rad s^-2',
  },
  
  '002': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Activation_Energy',  //Name
    desc: 'activation energy', //Encoding field1
    unit: 'J mol^-1',
  },

  '003': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Activity',  //Name
    desc: 'activity (radioactive)', //Encoding field1
    unit: 's^-1',
  },

  '004': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Mol',  //Name
    desc: 'amount of substance', //Encoding field1
    unit: 'mol',
  },

  '005': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Amplitude',  //Name
    desc: 'amplitude (unit as appropriate)', //Encoding field1
    unit: '',
  },

  '006': { //ID
    use: 'G', //Use
    name: 'DPT_Value_AngleRad',  //Name
    desc: 'angle, radiant', //Encoding field1
    unit: 'rad',
  },

  '007': { //ID
    use: 'G', //Use
    name: 'DPT_Value_AngleDeg',  //Name
    desc: 'angle, degree', //Encoding field1
    unit: '°',
  },

  '008': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Angular_Momentum',  //Name
    desc: 'angular momentum', //Encoding field1
    unit: 'J s',
  },

  '009': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Angular_Velocity',  //Name
    desc: 'angular velocity', //Encoding field1
    unit: 'rad s-1',
  },

  '010': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Area',  //Name
    desc: 'acceleration', //Encoding field1
    unit: 'm^2',
  },

  '011': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Capacitance',  //Name
    desc: 'capacitance', //Encoding field1
    unit: 'F',
  },

  '0012': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Charge_DensitySurface',  //Name
    desc: 'charge density (surface)', //Encoding field1
    unit: 'C m^-2',
  },

  '013': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Charge_DensityVolume',  //Name
    desc: 'charge density (volume)', //Encoding field1
    unit: 'C m^-3',
  },

  '014': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Compressibility',  //Name
    desc: 'compressibility', //Encoding field1
    unit: 'm2 N^-1',
  },

  '015': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Conductance',  //Name
    desc: 'conductance', //Encoding field1
    unit: 'S = Ω^-1',
  },

  '016': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electrical_Conductivity',  //Name
    desc: 'conductivity, electrical', //Encoding field1
    unit: 'S m^-1',
  },

  '017': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Density',  //Name
    desc: 'density', //Encoding field1
    unit: 'kg m^-3',
  },

  '018': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electric_Charge',  //Name
    desc: 'electric charge', //Encoding field1
    unit: 'C',
  },
  
  '019': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electric_Current',  //Name
    desc: 'electric current', //Encoding field1
    unit: 'A',
  },
  
  '020': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electric_CurrentDensity',  //Name
    desc: 'electric current density', //Encoding field1
    unit: 'A m^-2',
  },

  '021': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electric_DipoleMoment',  //Name
    desc: 'electric dipole moment', //Encoding field1
    unit: 'C m',
  },
  
  '022': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electric_Displacement',  //Name
    desc: '2 electric displacement', //Encoding field1
    unit: 'C m^-2',
  },

  '023': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electric_FieldStrength',  //Name
    desc: 'electric field strength', //Encoding field1
    unit: 'V m^-1',
  },

  '024': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electric_Flux',  //Name
    desc: 'electric flux', //Encoding field1
    unit: 'c',
  },

  '025': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electric_FluxDensity',  //Name
    desc: 'electric flux density', //Encoding field1
    unit: 'C m^-2',
  },

  '026': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electric_Polarization',  //Name
    desc: 'electric polarization', //Encoding field1
    unit: 'C m^-2',
  },

  '027': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electric_Potential',  //Name
    desc: 'electric potential', //Encoding field1
    unit: 'V',
  },

  '028': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electric_PotentialDifference',  //Name
    desc: 'electric potential difference', //Encoding field1
    unit: 'V',
  },

  '029': { //ID
    use: 'G', //Use
    name: 'DPT_Value_ElectromagneticMoment',  //Name
    desc: 'electromagnetic moment', //Encoding field1
    unit: 'A m^2',
  },

  '030': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Electromotive_Force',  //Name
    desc: 'electromotive force', //Encoding field1
    unit: 'V',
  },

  '031': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Energy',  //Name
    desc: 'energy', //Encoding field1
    unit: 'J',
  },

  '032': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Force',  //Name
    desc: 'force', //Encoding field1
    unit: 'N',
  },

  '033': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Frequency',  //Name
    desc: 'frequency', //Encoding field1
    unit: 'Hz = s^-1',
  },

  '034': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Angular_Frequency',  //Name
    desc: 'frequency, angular (pulsatance)', //Encoding field1
    unit: 'rad s^-1',
  },

  '035': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Heat_Capacity',  //Name
    desc: 'heat capacity', //Encoding field1
    unit: 'J K^-1',
  },

  '036': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Heat_FlowRate',  //Name
    desc: 'heat flow rate', //Encoding field1
    unit: 'W',
  },

  '037': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Heat_Quantity',  //Name
    desc: 'heat, quantity of', //Encoding field1
    unit: 'J',
  },

  '038': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Impedance',  //Name
    desc: 'impedance', //Encoding field1
    unit: 'Ω',
  },

  '039': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Length',  //Name
    desc: 'length', //Encoding field1
    unit: 'm',
  },

  '040': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Light_Quantity',  //Name
    desc: 'light, quantity of', //Encoding field1
    unit: 'J or lm s',
  },

  '041': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Luminance',  //Name
    desc: 'luminance', //Encoding field1
    unit: 'cd m^-2',
  },

  '042': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Luminous_Flux',  //Name
    desc: 'luminous flux', //Encoding field1
    unit: 'lm',
  },

  '043': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Luminous_Intensity',  //Name
    desc: 'luminous intensity', //Encoding field1
    unit: 'cd',
  },

  '044': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Magnetic_FieldStrength',  //Name
    desc: 'magnetic field strength', //Encoding field1
    unit: 'A m^-1',
  },

  '045': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Magnetic_Flux',  //Name
    desc: 'magnetic flux', //Encoding field1
    unit: 'Wb',
  },

  '046': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Magnetic_FluxDensity',  //Name
    desc: 'magnetic flux density', //Encoding field1
    unit: 'T',
  },

  '047': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Magnetic_Moment',  //Name
    desc: 'magnetic moment', //Encoding field1
    unit: 'A m^2',
  },

  '048': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Magnetic_Polarization',  //Name
    desc: 'magnetic polarization', //Encoding field1
    unit: 'T',
  },

  '049': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Magnetization',  //Name
    desc: 'magnetization', //Encoding field1
    unit: 'A m^-1',
  },

  '050': { //ID
    use: 'G', //Use
    name: 'DPT_Value_MagnetomotiveForce',  //Name
    desc: 'magneto motive force', //Encoding field1
    unit: 'A',
  },

  '051': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Mass',  //Name
    desc: 'mass', //Encoding field1
    unit: 'kg',
  },

  '052': { //ID
    use: 'G', //Use
    name: 'DPT_Value_MassFlux',  //Name
    desc: 'mass flux', //Encoding field1
    unit: 'kg s^-1',
  },

  '053': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Momentum',  //Name
    desc: 'momentum', //Encoding field1
    unit: 'N s^-1',
  },

  '054': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Phase_AngleRad',  //Name
    desc: 'phase angle, radiant', //Encoding field1
    unit: 'rad',
  },

  '055': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Phase_AngleDeg',  //Name
    desc: 'phase angle, degrees', //Encoding field1
    unit: '°',
  },

  '056': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Power',  //Name
    desc: 'power', //Encoding field1
    unit: 'W',
  },

  '057': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Power_Factor',  //Name
    desc: 'power factor', //Encoding field1
    unit: '',
  },

  '058': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Pressure',  //Name
    desc: 'pressure', //Encoding field1
    unit: 'Pa = N m^-2',
  },

  '059': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Reactance',  //Name
    desc: 'reactance', //Encoding field1
    unit: 'Ω',
  },

  '060': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Resistance',  //Name
    desc: 'resistance', //Encoding field1
    unit: 'Ω',
  },

  '061': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Resistivity',  //Name
    desc: 'resistivity', //Encoding field1
    unit: 'Ωm',
  },

  '062': { //ID
    use: 'G', //Use
    name: 'DPT_Value_SelfInductance',  //Name
    desc: 'self inductance', //Encoding field1
    unit: 'H',
  },

  '063': { //ID
    use: 'G', //Use
    name: 'DPT_Value_SolidAngle',  //Name
    desc: 'solid angle', //Encoding field1
    unit: 'sr',
  },

  '064': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Sound_Intensity',  //Name
    desc: 'sound intensity', //Encoding field1
    unit: 'W m^-2',
  },

  '065': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Speed',  //Name
    desc: 'speed', //Encoding field1
    unit: 'm s^-1',
  },

  '066': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Stress',  //Name
    desc: 'stress', //Encoding field1
    unit: 'Pa = N m^-2',
  },

  '067': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Surface_Tension',  //Name
    desc: 'surface tension', //Encoding field1
    unit: 'Nm^-1',
  },

  '068': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Common_Temperature',  //Name
    desc: 'emperature, common', //Encoding field1
    unit: '°C',
  },

  '069': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Absolute_Temperature',  //Name
    desc: 'temperature (absolute)', //Encoding field1
    unit: 'K',
  },

  '070': { //ID
    use: 'G', //Use
    name: 'DPT_Value_TemperatureDifference',  //Name
    desc: 'temperature difference', //Encoding field1
    unit: 'K',
  },

  '071': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Thermal_Capacity',  //Name
    desc: 'thermal capacity', //Encoding field1
    unit: 'JK^-1',
  },

  '072': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Thermal_Conductivity',  //Name
    desc: 'thermal conductivity', //Encoding field1
    unit: 'W m^-1 K^-1',
  },

  '073': { //ID
    use: 'G', //Use
    name: 'DPT_Value_ThermoelectricPower',  //Name
    desc: 'thermoelectric power', //Encoding field1
    unit: 'V K^-1',
  },

  '074': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Time',  //Name
    desc: 'time', //Encoding field1
    unit: 's',
  },

  '075': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Torque',  //Name
    desc: 'torque', //Encoding field1
    unit: 'Nm',
  },

  '076': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Volume',  //Name
    desc: 'volume', //Encoding field1
    unit: 'm^3',
  },

  '077': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Volume_Flux',  //Name
    desc: 'volume flux', //Encoding field1
    unit: 'm3 s^-1',
  },

  '078': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Weight',  //Name
    desc: 'weight', //Encoding field1
    unit: 'N',
  },

  '079': { //ID
    use: 'G', //Use
    name: 'DPT_Value_Work',  //Name
    desc: 'work', //Encoding field1
    unit: 'J',
  },

  '080': { //ID
    use: 'G', //Use
    name: 'DPT_Value_ApparentPower',  //Name
    desc: 'Apparent power', //Encoding field1
    unit: 'VA',
  }
};
