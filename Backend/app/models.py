from .database import Base
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime


class User(Base):
    __tablename__ = 'users'
    
    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    locations = relationship('Location', back_populates='user')
    safety_checks = relationship('SafetyCheck', back_populates='user')


class Location(Base):
    __tablename__ = 'locations'
    
    location_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.user_id'), nullable=False)
    label = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship('User', back_populates='locations')
    devices = relationship('Device', back_populates='location')
    safety_checks = relationship('SafetyCheck', back_populates='location')


class Device(Base):
    __tablename__ = 'devices'
    
    device_id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey('locations.location_id'), nullable=False)
    device_name = Column(String, nullable=False)
    serial_no = Column(String, unique=True, nullable=False)
    last_seen_at = Column(DateTime)
    location = relationship('Location', back_populates='devices')
    outlets = relationship('Outlet', back_populates='device')


class Outlet(Base):
    __tablename__ = 'outlets'
    
    outlet_id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey('devices.device_id'), nullable=False)
    outlet_index = Column(Integer, nullable=False)
    label = Column(String)
    enabled = Column(Boolean, default=True)
    device = relationship('Device', back_populates='outlets')
    sensors = relationship('Sensor', back_populates='outlet')
    alerts = relationship('Alert', back_populates='outlet')
    safety_check_items = relationship('SafetyCheckItem', back_populates='outlet')


class Sensor(Base):
    __tablename__ = 'sensors'
    
    sensor_id = Column(Integer, primary_key=True, index=True)
    outlet_id = Column(Integer, ForeignKey('outlets.outlet_id'), nullable=False)
    sensor_type = Column(String, nullable=False)
    unit = Column(String)
    installed_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    outlet = relationship('Outlet', back_populates='sensors')
    readings = relationship('SensorReading', back_populates='sensor')
    alert_rules = relationship('AlertRule', back_populates='sensor_type_rel')


class SensorReading(Base):
    __tablename__ = 'sensor_readings'
    
    reading_id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey('sensors.sensor_id'), nullable=False)
    ts = Column(DateTime, default=datetime.utcnow)
    value = Column(Float, nullable=False)
    sensor = relationship('Sensor', back_populates='readings')


class AlertRule(Base):
    __tablename__ = 'alert_rules'
    
    rule_id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey('sensors.sensor_id'), nullable=True)
    sensor_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    comparator = Column(String, nullable=False)
    threshold_value = Column(Float, nullable=False)
    duration_seconds = Column(Integer)
    enabled = Column(Boolean, default=True)
    sensor_type_rel = relationship('Sensor', foreign_keys=[sensor_id], back_populates='alert_rules')
    alerts = relationship('Alert', back_populates='rule')


class Alert(Base):
    __tablename__ = 'alerts'
    
    alert_id = Column(Integer, primary_key=True, index=True)
    outlet_id = Column(Integer, ForeignKey('outlets.outlet_id'), nullable=False)
    rule_id = Column(Integer, ForeignKey('alert_rules.rule_id'), nullable=False)
    severity = Column(String, nullable=False)
    start_ts = Column(DateTime, default=datetime.utcnow)
    end_ts = Column(DateTime)
    status = Column(String, nullable=False)
    message = Column(String)
    outlet = relationship('Outlet', back_populates='alerts')
    rule = relationship('AlertRule', back_populates='alerts')


class SafetyCheck(Base):
    __tablename__ = 'safety_checks'
    
    check_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.user_id'), nullable=False)
    location_id = Column(Integer, ForeignKey('locations.location_id'), nullable=False)
    ts = Column(DateTime, default=datetime.utcnow)
    overall_status = Column(String, nullable=False)
    notes = Column(String)
    user = relationship('User', back_populates='safety_checks')
    location = relationship('Location', back_populates='safety_checks')
    check_items = relationship('SafetyCheckItem', back_populates='check')


class SafetyCheckItem(Base):
    __tablename__ = 'safety_check_items'
    
    item_id = Column(Integer, primary_key=True, index=True)
    check_id = Column(Integer, ForeignKey('safety_checks.check_id'), nullable=False)
    outlet_id = Column(Integer, ForeignKey('outlets.outlet_id'), nullable=False)
    status = Column(String, nullable=False)
    reason = Column(String)
    check = relationship('SafetyCheck', back_populates='check_items')
    outlet = relationship('Outlet', back_populates='safety_check_items')