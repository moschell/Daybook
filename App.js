import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StatusBar,
  SafeAreaView,
  StyleSheet,
  Dimensions,
  Platform,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import BackgroundTimer from 'react-native-background-timer';
import PushNotification from 'react-native-push-notification';

const { width } = Dimensions.get('window');

// Simple icon component using emojis
const Icon = ({ name, size = 20, color = '#64748b' }) => {
  const icons = {
    'person-add': '👤',
    'briefcase': '💼',
    'download': '⬇️',
    'pause': '⏸️',
    'stop': '⏹️',
    'play': '▶️',
    'time': '⏰',
    'warning': '⚠️',
  };
  
  return (
    <Text style={{ fontSize: size, color }}>
      {icons[name] || '•'}
    </Text>
  );
};

const DaybookApp = () => {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [activeTimer, setActiveTimer] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [timerStartTime, setTimerStartTime] = useState(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newClient, setNewClient] = useState('');
  const [newProject, setNewProject] = useState({ name: '', clientId: '', rate: '' });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  const appState = useRef(AppState.currentState);
  const backgroundStartTime = useRef(null);

  // Initialize push notifications
  useEffect(() => {
    PushNotification.configure({
      onNotification: function(notification) {
        console.log('Notification:', notification);
      },
      requestPermissions: Platform.OS === 'ios',
    });
  }, []);

  // Handle app state changes for background timer
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (activeTimer) {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          // App came to foreground, calculate time elapsed
          if (backgroundStartTime.current) {
            const timeElapsed = Math.floor((Date.now() - backgroundStartTime.current) / 1000);
            setCurrentTime(prev => prev + timeElapsed);
            backgroundStartTime.current = null;
          }
        } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
          // App going to background
          backgroundStartTime.current = Date.now();
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [activeTimer]);

  // Load data on app start
  useEffect(() => {
    loadData();
  }, []);

  // Timer effect
  useEffect(() => {
    let interval = null;
    if (activeTimer && appState.current === 'active') {
      interval = setInterval(() => {
        setCurrentTime(time => time + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimer]);

  // Save data when state changes
  useEffect(() => {
    if (clients.length > 0 || projects.length > 0 || timeEntries.length > 0) {
      saveData();
    }
  }, [clients, projects, timeEntries]);

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  };

  const loadData = async () => {
    try {
      const clientsData = await AsyncStorage.getItem('clients');
      const projectsData = await AsyncStorage.getItem('projects');
      const entriesData = await AsyncStorage.getItem('timeEntries');
      const activeTimerData = await AsyncStorage.getItem('activeTimer');
      const timerData = await AsyncStorage.getItem('timerData');
      
      if (clientsData) setClients(JSON.parse(clientsData));
      if (projectsData) setProjects(JSON.parse(projectsData));
      if (entriesData) {
        const entries = JSON.parse(entriesData).map(entry => ({
          ...entry,
          date: new Date(entry.date)
        }));
        setTimeEntries(entries);
      }

      // Restore active timer if app was closed
      if (activeTimerData && timerData) {
        const timerInfo = JSON.parse(timerData);
        const projectId = JSON.parse(activeTimerData);
        const elapsedTime = Math.floor((Date.now() - timerInfo.startTime) / 1000);
        
        setActiveTimer(projectId);
        setCurrentTime(timerInfo.initialTime + elapsedTime);
        setTimerStartTime(timerInfo.startTime);
      }
    } catch (error) {
      showError('Error loading data. Please restart the app.');
      console.error('Error loading data:', error);
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem('clients', JSON.stringify(clients));
      await AsyncStorage.setItem('projects', JSON.stringify(projects));
      await AsyncStorage.setItem('timeEntries', JSON.stringify(timeEntries));
    } catch (error) {
      showError('Error saving data');
      console.error('Error saving data:', error);
    }
  };

  const saveTimerState = async (projectId, startTime, initialTime) => {
    try {
      if (projectId) {
        await AsyncStorage.setItem('activeTimer', JSON.stringify(projectId));
        await AsyncStorage.setItem('timerData', JSON.stringify({
          startTime,
          initialTime
        }));
      } else {
        await AsyncStorage.removeItem('activeTimer');
        await AsyncStorage.removeItem('timerData');
      }
    } catch (error) {
      console.error('Error saving timer state:', error);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const validateInput = (text, type) => {
    switch (type) {
      case 'client':
        return text.trim().length > 0 && text.trim().length <= 50;
      case 'project':
        return text.trim().length > 0 && text.trim().length <= 50;
      case 'rate':
        return text === '' || (!isNaN(parseFloat(text)) && parseFloat(text) >= 0 && parseFloat(text) <= 10000);
      default:
        return true;
    }
  };

  const addClient = () => {
    if (!validateInput(newClient, 'client')) {
      showError('Client name must be 1-50 characters long');
      return;
    }

    // Check for duplicate client names
    if (clients.some(client => client.name.toLowerCase() === newClient.trim().toLowerCase())) {
      showError('A client with this name already exists');
      return;
    }

    const client = {
      id: Date.now(),
      name: newClient.trim(),
      createdAt: new Date()
    };
    setClients([...clients, client]);
    setNewClient('');
    setShowClientModal(false);
  };

  const addProject = () => {
    if (!validateInput(newProject.name, 'project')) {
      showError('Project name must be 1-50 characters long');
      return;
    }

    if (!newProject.clientId) {
      showError('Please select a client');
      return;
    }

    if (!validateInput(newProject.rate, 'rate')) {
      showError('Hourly rate must be a valid number between 0 and 10,000');
      return;
    }

    // Check for duplicate project names within the same client
    const existingProject = projects.find(project => 
      project.clientId === parseInt(newProject.clientId) && 
      project.name.toLowerCase() === newProject.name.trim().toLowerCase()
    );

    if (existingProject) {
      showError('A project with this name already exists for this client');
      return;
    }

    const project = {
      id: Date.now(),
      name: newProject.name.trim(),
      clientId: parseInt(newProject.clientId),
      rate: parseFloat(newProject.rate) || 0,
      createdAt: new Date()
    };
    setProjects([...projects, project]);
    setNewProject({ name: '', clientId: '', rate: '' });
    setShowProjectModal(false);
  };

  const startTimer = (projectId) => {
    if (activeTimer && activeTimer !== projectId) {
      stopTimer();
    }

    const startTime = Date.now();
    setActiveTimer(projectId);
    setCurrentTime(0);
    setTimerStartTime(startTime);
    saveTimerState(projectId, startTime, 0);

    // Send notification permission request on iOS
    if (Platform.OS === 'ios') {
      PushNotification.requestPermissions();
    }
  };

  const pauseTimer = () => {
    if (activeTimer && currentTime > 0) {
      const entry = {
        id: Date.now(),
        projectId: activeTimer,
        duration: currentTime,
        date: new Date(),
        status: 'paused'
      };
      setTimeEntries(prev => [...prev, entry]);
      
      // Send local notification
      PushNotification.localNotification({
        title: 'Timer Paused',
        message: `${formatTime(currentTime)} recorded for your project`,
        playSound: true,
      });
    }
    
    setActiveTimer(null);
    setCurrentTime(0);
    setTimerStartTime(null);
    saveTimerState(null);
  };

  const stopTimer = () => {
    if (activeTimer && currentTime > 0) {
      const entry = {
        id: Date.now(),
        projectId: activeTimer,
        duration: currentTime,
        date: new Date(),
        status: 'completed'
      };
      setTimeEntries(prev => [...prev, entry]);
      
      // Send local notification
      PushNotification.localNotification({
        title: 'Timer Stopped',
        message: `${formatTime(currentTime)} recorded for your project`,
        playSound: true,
      });
    }
    
    setActiveTimer(null);
    setCurrentTime(0);
    setTimerStartTime(null);
    saveTimerState(null);
  };

  const exportToCSV = async () => {
    if (timeEntries.length === 0) {
      showError('No time entries to export');
      return;
    }

    setIsExporting(true);
    
    try {
      const headers = 'Date,Client,Project,Duration (hours),Rate,Total,Status\n';
      const rows = timeEntries.map(entry => {
        const project = projects.find(p => p.id === entry.projectId);
        const client = clients.find(c => c.id === project?.clientId);
        const hours = (entry.duration / 3600).toFixed(2);
        const total = (hours * (project?.rate || 0)).toFixed(2);
        
        return `"${entry.date.toLocaleDateString()}","${client?.name || 'Unknown'}","${project?.name || 'Unknown'}",${hours},${project?.rate || 0},${total},"${entry.status || 'completed'}"`;
      }).join('\n');

      const csvContent = headers + rows;
      const fileName = `daybook-export-${new Date().toISOString().split('T')[0]}.csv`;
      const path = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      
      await RNFS.writeFile(path, csvContent, 'utf8');
      
      const shareOptions = {
        title: 'Export Time Tracking Data',
        url: `file://${path}`,
        type: 'text/csv',
        filename: fileName,
      };

      await Share.open(shareOptions);
    } catch (error) {
      console.error('Export error:', error);
      if (error.message.includes('User did not share')) {
        // User cancelled sharing, not an error
        return;
      }
      showError('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getProjectWithClient = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    const client = clients.find(c => c.id === project?.clientId);
    return { project, client };
  };

  const getTotalHours = (projectId) => {
    const total = timeEntries
      .filter(entry => entry.projectId === projectId)
      .reduce((sum, entry) => sum + entry.duration, 0);
    return (total / 3600).toFixed(1);
  };

  const getTotalEarnings = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.rate) return 0;
    
    const totalSeconds = timeEntries
      .filter(entry => entry.projectId === projectId)
      .reduce((sum, entry) => sum + entry.duration, 0);
    
    const totalHours = totalSeconds / 3600;
    return (totalHours * project.rate).toFixed(2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Error Message */}
      {error && (
        <View style={styles.errorBanner}>
          <Icon name="warning" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Daybook</Text>
          <Text style={styles.subtitle}>Professional time tracking</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowClientModal(true)}>
            <Icon name="person-add" size={20} color="#64748b" />
            <Text style={styles.actionButtonText}>Add Client</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, clients.length === 0 && styles.disabledButton]}
            onPress={() => setShowProjectModal(true)}
            disabled={clients.length === 0}
          >
            <Icon name="briefcase" size={20} color="#64748b" />
            <Text style={styles.actionButtonText}>Add Project</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              styles.exportButton, 
              (timeEntries.length === 0 || isExporting) && styles.disabledButton
            ]} 
            onPress={exportToCSV}
            disabled={timeEntries.length === 0 || isExporting}
          >
            <Icon name="download" size={20} color="white" />
            <Text style={styles.exportButtonText}>
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Timer */}
        {activeTimer && (
          <View style={styles.activeTimerCard}>
            <Text style={styles.timerDisplay}>{formatTime(currentTime)}</Text>
            <Text style={styles.timerProject}>
              {(() => {
                const { project, client } = getProjectWithClient(activeTimer);
                return `${client?.name || 'Unknown'} • ${project?.name || 'Unknown'}`;
              })()}
            </Text>
            <View style={styles.timerControls}>
              <TouchableOpacity style={styles.pauseButton} onPress={pauseTimer}>
                <Icon name="pause" size={20} color="white" />
                <Text style={styles.controlButtonText}>Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopButton} onPress={stopTimer}>
                <Icon name="stop" size={20} color="white" />
                <Text style={styles.controlButtonText}>Stop</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Projects */}
        <View style={styles.projectsContainer}>
          {projects.map(project => {
            const client = clients.find(c => c.id === project.clientId);
            const isActive = activeTimer === project.id;
            const totalHours = getTotalHours(project.id);
            const totalEarnings = getTotalEarnings(project.id);
            
            return (
              <View 
                key={project.id} 
                style={[styles.projectCard, isActive && styles.activeProjectCard]}
              >
                <View style={styles.projectHeader}>
                  <View style={styles.projectInfo}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <Text style={styles.clientName}>{client?.name || 'Unknown Client'}</Text>
                    {project.rate > 0 && (
                      <Text style={styles.projectRate}>${project.rate}/hour</Text>
                    )}
                  </View>
                  <View style={styles.projectStats}>
                    <Text style={styles.statsLabel}>Total Hours</Text>
                    <Text style={styles.statsValue}>{totalHours}h</Text>
                    {project.rate > 0 && (
                      <>
                        <Text style={styles.statsLabel}>Earnings</Text>
                        <Text style={styles.statsValue}>${totalEarnings}</Text>
                      </>
                    )}
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.timerButton,
                    isActive ? styles.pauseTimerButton : styles.startTimerButton,
                    activeTimer && !isActive && styles.disabledButton
                  ]}
                  onPress={() => isActive ? pauseTimer() : startTimer(project.id)}
                  disabled={activeTimer && !isActive}
                >
                  <Icon 
                    name={isActive ? "pause" : "play"} 
                    size={20} 
                    color="white" 
                  />
                  <Text style={styles.timerButtonText}>
                    {isActive ? 'Pause Timer' : 'Start Timer'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Recent Time Entries */}
        {timeEntries.length > 0 && (
          <View style={styles.recentEntriesCard}>
            <Text style={styles.sectionTitle}>Recent Time Entries</Text>
            {timeEntries.slice(-10).reverse().map(entry => {
              const { project, client } = getProjectWithClient(entry.projectId);
              const hours = (entry.duration / 3600).toFixed(2);
              
              return (
                <View key={entry.id} style={styles.entryRow}>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryProject}>
                      {client?.name || 'Unknown'} • {project?.name || 'Unknown'}
                    </Text>
                    <Text style={styles.entryDetails}>
                      {entry.date.toLocaleDateString()} • {hours}h • {entry.status}
                    </Text>
                  </View>
                  <View style={styles.entryTime}>
                    <Text style={styles.entryDuration}>{formatTime(entry.duration)}</Text>
                    {project?.rate > 0 && (
                      <Text style={styles.entryEarnings}>
                        ${(hours * project.rate).toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {projects.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="time" size={64} color="#cbd5e1" />
            <Text style={styles.emptyStateTitle}>No projects yet</Text>
            <Text style={styles.emptyStateText}>
              Add a client and create your first project to start tracking time
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Client Modal */}
      <Modal visible={showClientModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Client</Text>
            <TextInput
              style={[styles.input, !validateInput(newClient, 'client') && newClient.length > 0 && styles.inputError]}
              value={newClient}
              onChangeText={setNewClient}
              placeholder="Client name (1-50 characters)"
              returnKeyType="done"
              onSubmitEditing={addClient}
              maxLength={50}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.primaryButton, !validateInput(newClient, 'client') && styles.disabledButton]} 
                onPress={addClient}
                disabled={!validateInput(newClient, 'client')}
              >
                <Text style={styles.primaryButtonText}>Add Client</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={() => {
                  setShowClientModal(false);
                  setNewClient('');
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Project Modal */}
      <Modal visible={showProjectModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Project</Text>
            <TextInput
              style={[styles.input, !validateInput(newProject.name, 'project') && newProject.name.length > 0 && styles.inputError]}
              value={newProject.name}
              onChangeText={(text) => setNewProject({...newProject, name: text})}
              placeholder="Project name (1-50 characters)"
              maxLength={50}
            />
            
            {clients.length > 0 ? (
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Select Client:</Text>
                <ScrollView style={styles.pickerScroll} nestedScrollEnabled={true}>
                  {clients.map(client => (
                    <TouchableOpacity
                      key={client.id}
                      style={[
                        styles.pickerOption,
                        newProject.clientId == client.id && styles.pickerOptionSelected
                      ]}
                      onPress={() => setNewProject({...newProject, clientId: client.id.toString()})}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        newProject.clientId == client.id && styles.pickerOptionTextSelected
                      ]}>
                        {client.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <Text style={styles.noClientsText}>Please add a client first</Text>
            )}
            
            <TextInput
              style={[styles.input, !validateInput(newProject.rate, 'rate') && newProject.rate.length > 0 && styles.inputError]}
              value={newProject.rate}
              onChangeText={(text) => setNewProject({...newProject, rate: text})}
              placeholder="Hourly rate (optional, 0-10,000)"
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[
                  styles.primaryButton,
                  (!validateInput(newProject.name, 'project') || !newProject.clientId || !validateInput(newProject.rate, 'rate')) && styles.disabledButton
                ]} 
                onPress={addProject}
                disabled={!validateInput(newProject.name, 'project') || !newProject.clientId || !validateInput(newProject.rate, 'rate')}
              >
                <Text style={styles.primaryButtonText}>Add Project</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={() => {
                  setShowProjectModal(false);
                  setNewProject({ name: '', clientId: '', rate: '' });
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 32,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
    minWidth: 100,
  },
  actionButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '500',
  },
  exportButton: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#cbd5e1',
    borderColor: '#cbd5e
