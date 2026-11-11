import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  ListRenderItemInfo,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { useContacts } from '../hooks/useContacts';
import { Dialer } from '../services/dialer';
import { colors, fonts } from '../theme';
import type { Contact } from '../types';

// ── Contact form modal ────────────────────────────────────────────────────────
interface FormModalProps {
  visible: boolean;
  initial?: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}
const FormModal = memo(function FormModal({ visible, initial, onClose, onSaved }: FormModalProps) {
  const [name,   setName]   = useState(initial?.name   ?? '');
  const [number, setNumber] = useState(initial?.number ?? '');
  const [saving, setSaving] = useState(false);
  const nameRef   = useRef<TextInput>(null);
  const numberRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setName(initial?.name   ?? '');
      setNumber(initial?.number ?? '');
      setSaving(false);
      // Focus name field after modal opens
      const t = setTimeout(() => nameRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [visible, initial]);

  const isEditing = !!initial;

  const handleSave = useCallback(async () => {
    const n = name.trim();
    const p = number.trim().replace(/\s/g, '');
    if (!n)  { Alert.alert('Required', 'Enter a name');   return; }
    if (!p)  { Alert.alert('Required', 'Enter a number'); return; }
    Keyboard.dismiss();
    setSaving(true);
    try {
      if (isEditing && initial) {
        // Edit = delete old + create new (simpler than partial-update via ContentProviderOperation batch)
        await Dialer.deleteContact(initial.id);
        await Dialer.addContact({ name: n, number: p });
      } else {
        await Dialer.addContact({ name: n, number: p });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error)?.message ?? 'Could not save contact');
      setSaving(false);
    }
  }, [name, number, isEditing, initial, onSaved, onClose]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(180)} style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <Animated.View entering={SlideInDown.springify().damping(22).stiffness(260)} exiting={SlideOutDown.duration(220)} style={styles.sheet}>
            {/* Handle */}
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{isEditing ? 'Edit Contact' : 'New Contact'}</Text>

            <View style={styles.fieldGroup}>
              <View style={styles.field}>
                <Ionicons name="person-outline" size={18} color={colors.textDim} style={styles.fieldIcon} />
                <TextInput
                  ref={nameRef}
                  style={styles.fieldInput}
                  placeholder="Full name"
                  placeholderTextColor={colors.textDim}
                  value={name}
                  onChangeText={setName}
                  returnKeyType="next"
                  onSubmitEditing={() => numberRef.current?.focus()}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
              <View style={[styles.field, { marginTop: 10 }]}>
                <Ionicons name="call-outline" size={18} color={colors.textDim} style={styles.fieldIcon} />
                <TextInput
                  ref={numberRef}
                  style={styles.fieldInput}
                  placeholder="Phone number"
                  placeholderTextColor={colors.textDim}
                  value={number}
                  onChangeText={setNumber}
                  returnKeyType="done"
                  keyboardType="phone-pad"
                  onSubmitEditing={handleSave}
                />
              </View>
            </View>

            <View style={styles.sheetActions}>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={[styles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveText}>{isEditing ? 'Save' : 'Add Contact'}</Text>
                }
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
});

// ── Contact row ───────────────────────────────────────────────────────────────
interface RowProps {
  item: Contact;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
}

const ContactRow = memo(function ContactRow({ item, onEdit, onDelete }: RowProps) {
  const scale = useSharedValue(1);

  const dial = useCallback(() => {
    // Private contact has empty number — route through callPrivate() so the number is never in JS
    const p = item.number ? Dialer.dial(item.number) : Dialer.callPrivate();
    p.catch((e: unknown) =>
      Alert.alert('Call failed', (e as Error)?.message ?? 'Unable to place call')
    );
  }, [item.number]);

  const handlePressIn  = useCallback(() => { scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }); }, [scale]);
  const handlePressOut = useCallback(() => { scale.value = withSpring(1,    { damping: 20, stiffness: 400 }); }, [scale]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeInDown.duration(220).easing(Easing.out(Easing.cubic))} style={rowStyle}>
      <Pressable
        onPress={dial}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.row}
        android_ripple={{ color: 'rgba(255,255,255,0.05)' }}
      >
        <Avatar size={46} photoUri={item.photoUri} name={item.name} />
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          {/* Show number for normal contacts; hide for private (number is '') */}
          <Text style={styles.rowSub} numberOfLines={1}>
            {item.number ? item.number : 'Private'}
          </Text>
        </View>
        {/* Quick-call button */}
        <Pressable
          onPress={dial}
          hitSlop={12}
          style={styles.callIcon}
          android_ripple={{ color: 'rgba(0,255,100,0.1)', borderless: true }}
        >
          <Ionicons name="call" size={19} color={colors.green} />
        </Pressable>
        {/* More options — hide delete for private pinned contact */}
        <Pressable
          onPress={() => {
            if (!item.number) {
              // Private contact — no edit/delete
              Alert.alert(item.name, 'This is a private contact.', [{ text: 'OK' }]);
              return;
            }
            Alert.alert(item.name, item.number, [
              { text: 'Edit',   onPress: () => onEdit(item) },
              { text: 'Delete', onPress: () => onDelete(item), style: 'destructive' },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          hitSlop={12}
          style={styles.moreIcon}
          android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: true }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textDim} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
});

// ── Main ContactsScreen ───────────────────────────────────────────────────────
export function ContactsScreen() {
  const { contacts, loading, error, refresh } = useContacts();
  const [query,       setQuery]       = useState('');
  const [showForm,    setShowForm]    = useState(false);
  const [editTarget,  setEditTarget]  = useState<Contact | null>(null);
  const fabScale = useSharedValue(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.number.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    );
  }, [contacts, query]);

  const openNew  = useCallback(() => { setEditTarget(null); setShowForm(true); }, []);
  const openEdit = useCallback((c: Contact) => { setEditTarget(c); setShowForm(true); }, []);
  const closeForm = useCallback(() => setShowForm(false), []);

  const handleDelete = useCallback((c: Contact) => {
    Alert.alert(
      'Delete Contact',
      `Remove "${c.name}" from your contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await Dialer.deleteContact(c.id);
              refresh();
            } catch (e: unknown) {
              Alert.alert('Error', (e as Error)?.message ?? 'Could not delete contact');
            }
          },
        },
      ]
    );
  }, [refresh]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<Contact>) => (
    <ContactRow item={item} onEdit={openEdit} onDelete={handleDelete} />
  ), [openEdit, handleDelete]);

  const keyExtractor = useCallback((item: Contact) => item.id + item.number, []);
  const separator    = useCallback(() => <View style={styles.sep} />, []);

  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));
  const pressFABIn  = () => { fabScale.value = withTiming(0.92, { duration: 100 }); };
  const pressFABOut = () => { fabScale.value = withSpring(1, { damping: 15, stiffness: 300 }); };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
        <Text style={styles.headerCount}>{contacts.length > 0 ? `${contacts.length}` : ''}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={17} color={colors.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name or number…"
          placeholderTextColor={colors.textDim}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={14}>
            <Ionicons name="close-circle" size={17} color={colors.textDim} />
          </Pressable>
        )}
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.hint}>Loading contacts…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.textDim} />
          <Text style={styles.hint}>{error}</Text>
          <Pressable onPress={refresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={separator}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={25}
          maxToRenderPerBatch={30}
          windowSize={12}
          removeClippedSubviews
          onRefresh={refresh}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="people-outline" size={52} color={colors.textDim} />
              <Text style={styles.hint}>
                {query ? 'No contacts match' : 'No contacts yet'}
              </Text>
              {!query && (
                <Pressable onPress={openNew} style={styles.retryBtn}>
                  <Text style={styles.retryText}>Add first contact</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* FAB — New Contact */}
      <Animated.View style={[styles.fab, fabStyle]}>
        <Pressable
          onPress={openNew}
          onPressIn={pressFABIn}
          onPressOut={pressFABOut}
          style={styles.fabInner}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true }}
        >
          <Ionicons name="person-add" size={22} color="#fff" />
          <Text style={styles.fabLabel}>New</Text>
        </Pressable>
      </Animated.View>

      {/* Add / Edit modal */}
      <FormModal
        visible={showForm}
        initial={editTarget}
        onClose={closeForm}
        onSaved={refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  header:      { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  headerTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 24, flex: 1 },
  headerCount: { color: colors.textDim, fontFamily: fonts.medium, fontSize: 14 },
  searchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15, padding: 0 },
  list:        { paddingHorizontal: 16, paddingBottom: 100 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 13 },
  rowText:     { flex: 1 },
  rowName:     { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  rowSub:      { color: colors.textDim, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  callIcon:    { padding: 8 },
  moreIcon:    { padding: 8 },
  sep:         { height: 1, backgroundColor: colors.border, marginLeft: 59 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 36, paddingVertical: 60 },
  hint:        { color: colors.textDim, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
  retryBtn:    { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  retryText:   { color: colors.accent, fontFamily: fonts.medium, fontSize: 14 },
  // FAB
  fab:         { position: 'absolute', bottom: 20, right: 20, borderRadius: 22, overflow: 'hidden', elevation: 10, shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 },
  fabInner:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 14 },
  fabLabel:    { color: '#fff', fontFamily: fonts.semibold, fontSize: 15 },
  // Modal / sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap:    { justifyContent: 'flex-end' },
  sheet:        { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, borderTopWidth: 1, borderColor: colors.border },
  handle:       { width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:   { color: colors.text, fontFamily: fonts.semibold, fontSize: 20, marginBottom: 20 },
  fieldGroup:   { gap: 0 },
  field:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  fieldIcon:    { flexShrink: 0 },
  fieldInput:   { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 16, padding: 0 },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn:    { flex: 1, padding: 14, borderRadius: 14, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText:   { color: colors.textDim, fontFamily: fonts.medium, fontSize: 15 },
  saveBtn:      { flex: 2, padding: 14, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  saveText:     { color: '#fff', fontFamily: fonts.semibold, fontSize: 15 },
});
