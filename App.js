import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [showClientModal, setShowClientModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newClient, setNewClient] = useState('');
  const [newProject, setNewProject] = useState({ name: '', clientId: '', rate: '' });

  // Load data on app start
  useEffect(() => {
    loadData();
  }, []);

  // Timer effect
  useEffect(() => {
    let interval = null;
    if (activeTimer) {
      interval = setInterval(() => {
        setCurrentTime(time => time + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  // Save data when state changes
  useEffect(() => {
    saveData();
  }, [clients, projects, timeEntries]);

  const loadData = async () => {
    try {
      const clientsData = await AsyncStorage.getItem('clients');
      const projectsData = await AsyncStorage.getItem('projects');
      const entriesData = await AsyncStorage.getItem('timeEntries');
      
      if (clientsData) setClients(JSON.parse(clientsData));
      if (projectsData) setProjects(JSON.parse(projectsData));
      if (entriesData) {
        const entries = JSON.parse(entriesData).map(entry => ({
          ...entry,
          date: new Date(entry.date)
        }));
        setTimeEntries(entries);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem('clients', JSON.stringify(clients));
      await AsyncStorage.setItem('projects', JSON.stringify(projects));
      await AsyncStorage.setItem('timeEntries', JSON.stringify(timeEntries));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addClient = () => {
    if (newClient.trim()) {
      const client = {
        id: Date.now(),
        name: newClient.trim(),
        createdAt: new Date()
      };
      setClients([...clients, client]);
      setNewClient('');
      setShowClientModal(false);
    }
  };

  const addProject = () => {
    if (newProject.name.trim() && newProject.clientId) {
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
    }
  };

  const startTimer = (projectId) => {
    if (activeTimer) {
      stopTimer();
    }
    setActiveTimer(projectId);
    setCurrentTime(0);
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
      setTimeEntries([...timeEntries, entry]);
    }
    setActiveTimer(null);
    setCurrentTime(0);
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
      setTimeEntries([...timeEntries, entry]);
    }
    setActiveTimer(null);
    setCurrentTime(0);
  };

  const exportToCSV = () => {
    const headers = 'Date,Client,Project,Duration (hours),Rate,Total\n';
    const rows = timeEntries.map(entry => {
      const project = projects.find(p => p.id === entry.projectId);
      const client = clients.find(c => c.id === project?.clientId);
      const hours = (entry.duration / 3600).toFixed(2);
      const total = (hours * (project?.rate || 0)).toFixed(2);
      
      return `${entry.date.toLocaleDateString()},${client?.name || 'Unknown'},${project?.name || 'Unknown'},${hours},${project?.rate || 0},${total}`;
    }).join('\n');

    const csvContent = headers + rows;
    
    // For now, show in alert - you can implement file sharing later
    Alert.alert(
      'CSV Export', 
      'Time tracking data exported successfully!\n\nIn the final version, this will create a file you can share.',
      [
        { text: 'Copy Data', onPress: () => {
          // In a real app, you'd copy to clipboard or share via iOS sharing
          console.log(csvContent);
        }},
        { text: 'OK' }
      ]
    );
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Daybook</Text>
          <Text style={styles.subtitle}>Simple, beautiful time tracking</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowClientModal(true)}>
            <Icon name="person-add" size={20} color="#64748b" />
            <Text style={styles.actionButtonText}>Add Client</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowProjectModal(true)}>
            <Icon name="briefcase" size={20} color="#64748b" />
            <Text style={styles.actionButtonText}>Add Project</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.exportButton, timeEntries.length === 0 && styles.disabledButton]} 
            onPress={exportToCSV}
            disabled={timeEntries.length === 0}
          >
            <Icon name="download" size={20} color="white" />
            <Text style={styles.exportButtonText}>Export CSV</Text>
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
                      {entry.date.toLocaleDateString()} • {hours}h
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
              style={styles.input}
              value={newClient}
              onChangeText={setNewClient}
              placeholder="Client name"
              returnKeyType="done"
              onSubmitEditing={addClient}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={addClient}>
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
              style={styles.input}
              value={newProject.name}
              onChangeText={(text) => setNewProject({...newProject, name: text})}
              placeholder="Project name"
            />
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
            <TextInput
              style={styles.input}
              value={newProject.rate}
              onChangeText={(text) => setNewProject({...newProject, rate: text})}
              placeholder="Hourly rate (optional)"
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[
                  styles.primaryButton,
                  (!newProject.name.trim() || !newProject.clientId) && styles.disabledButton
                ]} 
                onPress={addProject}
                disabled={!newProject.name.trim() || !newProject.clientId}
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
    borderColor: '#cbd5e1',
  },
  activeTimerCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 32,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: '300',
    color: '#1e293b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 16,
  },
  timerProject: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  timerControls: {
    flexDirection: 'row',
    gap: 12,
  },
  pauseButton: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  stopButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  projectsContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
    gap: 16,
  },
  projectCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  activeProjectCard: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 4,
  },
  clientName: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  projectRate: {
    fontSize: 14,
    color: '#059669',
  },
  projectStats: {
    alignItems: 'flex-end',
  },
  statsLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1e293b',
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  startTimerButton: {
    backgroundColor: '#3b82f6',
  },
  pauseTimerButton: {
    backgroundColor: '#f59e0b',
  },
  timerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  recentEntriesCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 32,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 16,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  entryInfo: {
    flex: 1,
  },
  entryProject: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 4,
  },
  entryDetails: {
    fontSize: 14,
    color: '#64748b',
  },
  entryTime: {
    alignItems: 'flex-end',
  },
  entryDuration: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 2,
  },
  entryEarnings: {
    fontSize: 14,
    color: '#059669',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: width - 40,
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 8,
  },
  pickerScroll: {
    maxHeight: 120,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerOptionSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#64748b',
  },
  pickerOptionTextSelected: {
    color: '#3b82f6',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default DaybookApp;
