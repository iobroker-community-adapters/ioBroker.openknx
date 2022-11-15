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
  // TODO
  '007': {
    name: 'DPT_Value_AngleDeg°',
    desc: 'angle, degree',
    unit: '°',
  },

  '019': {
    name: 'DPT_Value_Electric_Current',
    desc: 'electric current',
    unit: 'A',
  },

  '027': {
    name: 'DPT_Value_Electric_Potential',
    desc: 'electric potential',
    unit: 'V',
  },

  '028': {
    name: 'DPT_Value_Electric_PotentialDifference',
    desc: 'electric potential difference',
    unit: 'V',
  },

  '031': {
    name: 'DPT_Value_Energ',
    desc: 'energy',
    unit: 'J',
  },

  '032': {
    name: 'DPT_Value_Force',
    desc: 'force',
    unit: 'N',
  },

  '033': {
    name: 'DPT_Value_Frequency',
    desc: 'frequency',
    unit: 'Hz',
  },

  '036': {
    name: 'DPT_Value_Heat_FlowRate',
    desc: 'heat flow rate',
    unit: 'W',
  },

  '037': {
    name: 'DPT_Value_Heat_Quantity',
    desc: 'heat, quantity of',
    unit: 'J',
  },

  '038': {
    name: 'DPT_Value_Impedance',
    desc: 'impedance',
    unit: 'Ω',
  },

  '039': {
    name: 'DPT_Value_Length',
    desc: 'length',
    unit: 'm',
  },

  '051': {
    name: 'DPT_Value_Mass',
    desc: 'mass',
    unit: 'kg',
  },

  '056': {
    name: 'DPT_Value_Power',
    desc: 'power',
    unit: 'W',
  },
  
  "057": {
    "desc": "DPT_Value_Power_Factor",
    "name": "Power factor",
    "unit": "cos Φ"
  },
  
  "058": {
    "desc": "DPT_Value_Pressure",
    "name": "Pressure (Pa)",
    "unit": "Pa"
  },
  
  '065': {
    name: 'DPT_Value_Speed',
    desc: 'speed',
    unit: 'm/s',
  },

  '066': {
    name: 'DPT_Value_Stress',
    desc: 'stress',
    unit: 'Pa',
  },

  '067': {
    name: 'DPT_Value_Surface_Tension',
    desc: 'surface tension',
    unit: '1/Nm',
  },

  '068': {
    name: 'DPT_Value_Common_Temperature',
    desc: 'temperature, common',
    unit: '°C',
  },

  '069': {
    name: 'DPT_Value_Absolute_Temperature',
    desc: 'temperature (absolute)',
    unit: 'K',
  },

  '070': {
    name: 'DPT_Value_TemperatureDifference',
    desc: 'temperature difference',
    unit: 'K',
  },

  '078': {
    name: 'DPT_Value_Weight',
    desc: 'weight',
    unit: 'N',
  },
  
  '076': {
    'desc': 'DPT_Value_Volume',
    'name': 'Volume',
    'unit': 'm3'
  },
  
  '078': {
    'desc': 'DPT_Value_Weight',
    'name': 'Weight',
    'unit': 'N'
  },
  
  '079': {
    name: 'DPT_Value_Work',
    desc: 'work',
    unit: 'J',
  }
};

/*
todo
14.000 F32 DPT_Value_Acceleration
14.001 F32 DPT_Value_Acceleration_Angular
14.002 F32 DPT_Value_Activation_Energy
14.003 F32 DPT_Value_Activity
14.004 F32 DPT_Value_Mol
14.005 F32 DPT_Value_Amplitude
14.006 F32 DPT_Value_AngleRad
14.007 F32 DPT_Value_AngleDeg
14.008 F32 DPT_Value_Angular_Momentum
14.009 F32 DPT_Value_Angular_Velocity
14.010 F32 DPT_Value_Area
14.011 F32 DPT_Value_Capacitance
14.012 F32 DPT_Value_Charge_DensitySurface
14.013 F32 DPT_Value_Charge_DensityVolume
14.014 F32 DPT_Value_Compressibility
14.015 F32 DPT_Value_Conductance
14.016 F32 DPT_Value_Electrical_Conductivity
14.017 F32 DPT_Value_Density
14.018 F32 DPT_Value_Electric_Charge
14.019 F32 DPT_Value_Electric_Current
14.020 F32 DPT_Value_Electric_CurrentDensity
14.021 F32 DPT_Value_Electric_DipoleMoment
14.022 F32 DPT_Value_Electric_Displacement
14.023 F32 DPT_Value_Electric_FieldStrength
14.024 F32 DPT_Value_Electric_Flux
14.025 F32 DPT_Value_Electric_FluxDensity
14.026 F32 DPT_Value_Electric_Polarization
14.027 F32 DPT_Value_Electric_Potential
14.028 F32 DPT_Value_Electric_PotentialDifference
14.029 F32 DPT_Value_ElectromagneticMoment
14.030 F32 DPT_Value_Electromotive_Force
14.031 F32 DPT_Value_Energy
14.032 F32 DPT_Value_Force
14.033 F32 DPT_Value_Frequency
14.034 F32 DPT_Value_Angular_Frequency
14.035 F32 DPT_Value_Heat_Capacity
14.036 F32 DPT_Value_Heat_FlowRate
14.037 F32 DPT_Value_Heat_Quantity
14.038 F32 DPT_Value_Impedance
14.039 F32 DPT_Value_Length
14.040 F32 DPT_Value_Light_Quantity
14.041 F32 DPT_Value_Luminance
14.042 F32 DPT_Value_Luminous_Flux
14.043 F32 DPT_Value_Luminous_Intensity
14.044 F32 DPT_Value_Magnetic_FieldStrength
14.045 F32 DPT_Value_Magnetic_Flux
14.046 F32 DPT_Value_Magnetic_FluxDensity
14.047 F32 DPT_Value_Magnetic_Moment
14.048 F32 DPT_Value_Magnetic_Polarization
14.049 F32 DPT_Value_Magnetization
14.050 F32 DPT_Value_MagnetomotiveForce
14.051 F32 DPT_Value_Mass
14.052 F32 DPT_Value_MassFlux
14.053 F32 DPT_Value_Momentum
14.054 F32 DPT_Value_Phase_AngleRad
14.055 F32 DPT_Value_Phase_AngleDeg
14.056 F32 DPT_Value_Power
14.057 F32 DPT_Value_Power_Factor
14.058 F32 DPT_Value_Pressure
14.059 F32 DPT_Value_Reactance
14.060 F32 DPT_Value_Resistance
14.061 F32 DPT_Value_Resistivity
14.062 F32 DPT_Value_SelfInductance
14.063 F32 DPT_Value_SolidAngle
14.064 F32 DPT_Value_Sound_Intensity
14.065 F32 DPT_Value_Speed
14.066 F32 DPT_Value_Stress
14.067 F32 DPT_Value_Surface_Tension
14.068 F32 DPT_Value_Common_Temperature
14.069 F32 DPT_Value_Absolute_Temperature
14.070 F32 DPT_Value_TemperatureDifference
14.071 F32 DPT_Value_Thermal_Capacity
14.072 F32 DPT_Value_Thermal_Conductivity
14.073 F32 DPT_Value_ThermoelectricPower
14.074 F32 DPT_Value_Time
14.075 F32 DPT_Value_Torque
14.076 F32 DPT_Value_Volume
*/