import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CogIcon,
  SearchIcon,
  UploadIcon,
} from '@sanity/icons'
import {
  Box,
  Button,
  Card,
  Container,
  Dialog,
  Flex,
  Grid,
  Inline,
  Select,
  Spinner,
  Stack,
  studioTheme,
  Text,
  TextInput,
  ThemeProvider,
  Tooltip,
} from '@sanity/ui'
import { useMachine } from '@xstate/react'
import { useContext } from 'react'
import { Accept } from 'react-dropzone'
import { useSanityClient } from '../../scripts/sanityClient'
import { SanityUpload, VendorConfiguration } from '../../types'
import ConfigureCredentials from '../Credentials/ConfigureCredentials'
import { CredentialsContext } from '../Credentials/CredentialsProvider'
import Uploader, { UploaderProps } from '../Uploader/Uploader'
import FileDetails from './FileDetails'
import FilePreview from './FilePreview'
import browserMachine, { LIMITS } from './browserMachine'

interface BrowserProps {
  onSelect?: (file: SanityUpload) => void
  accept?: UploaderProps['accept']
  vendorConfig: VendorConfiguration
}

function getFilterForExtension(accept?: Accept) {
  if (!accept) {
    return
  }

  /** @example ['pdf', 'image/png', '.html'] */
  const acceptedExtensionsOrMimes = Object.entries(accept).flatMap(
    ([key, value]) => {
      return value.map((extension) => `${key.replace('*', extension)}`)
    },
  )

  return acceptedExtensionsOrMimes
    .map((extensionOrMime) => `contentType match "**${extensionOrMime}"`)
    .join(' || ')
}

const getFileNameFilter = (term: string) => {
  if (!term) return
  return `fileName match "*${term}*"`
}

const Browser: React.FC<BrowserProps> = (props) => {
  const { onSelect, accept = props.vendorConfig?.defaultAccept } = props
  const sanityClient = useSanityClient()
  const placement = props.onSelect ? 'input' : 'tool'
  const [state, send] = useMachine(browserMachine, {
    services: {
      fetchFiles: (context) => {
        const filters = [
          `_type == "${props.vendorConfig?.schemaPrefix}.storedFile"`,
          'defined(fileURL)',
          getFilterForExtension(accept),
          getFileNameFilter(context.searchTerm),
        ]
        const offset = (context.page - 1) * context.limit

        return sanityClient.fetch(/* groq */ `
        *[${filters
          .filter(Boolean)
          .map((f) => `(${f})`)
          .join(
            ' && ',
          )}] [${offset}...${offset + context.limit}] | order(_createdAt desc)
          `)
      },
    },
  })
  const { status } = useContext(CredentialsContext)

  return (
    <ThemeProvider theme={studioTheme}>
      <Card
        padding={2}
        style={{
          minHeight: placement === 'input' ? '300px' : '100%',
          boxSizing: 'border-box',
        }}
        tone="default"
      >
        <Flex direction="column" gap={2}>
          {state.matches('loading') ? (
            <Flex flex={1} justify="center" align="center">
              <Spinner />
            </Flex>
          ) : status === 'missingCredentials' ? (
            <Container width={1}>
              <ConfigureCredentials vendorConfig={props.vendorConfig} />
            </Container>
          ) : (
            <Container padding={2} width={3} sizing="border" flex={1}>
              <Flex justify="space-between" align="center">
                <TextInput
                  value={state.context.searchTerm}
                  icon={SearchIcon}
                  onInput={(e: React.FormEvent<HTMLInputElement>) =>
                    send({
                      type: 'SEARCH_TERM',
                      term: e.currentTarget.value,
                    })
                  }
                  placeholder="Search files"
                />
                <Inline space={2}>
                  {status === 'success' && (
                    <Button
                      icon={UploadIcon}
                      mode="ghost"
                      tone="primary"
                      text="Upload new file"
                      fontSize={2}
                      onClick={() => send('OPEN_UPLOAD')}
                    />
                  )}
                  {props.vendorConfig.credentialsFields?.length > 0 && (
                    <Tooltip
                      content={
                        <Box padding={3}>
                          <Text>Plugin settings</Text>
                        </Box>
                      }
                    >
                      <Button
                        icon={CogIcon}
                        mode="ghost"
                        tone="default"
                        fontSize={2}
                        onClick={() => send('OPEN_SETTINGS')}
                      />
                    </Tooltip>
                  )}
                </Inline>
              </Flex>
              <Flex
                style={{
                  margin: '2rem 0 -1rem',
                  gap: '1rem',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Button
                  icon={ChevronLeftIcon}
                  mode="ghost"
                  fontSize={2}
                  onClick={() => send('PAGE_PRE')}
                />
                <Text>{state.context.page}</Text>
                <Button
                  icon={ChevronRightIcon}
                  mode="ghost"
                  fontSize={2}
                  onClick={() => send('PAGE_NEXT')}
                />
                <Text>limit</Text>
                <Stack>
                  <Select
                    value={state.context.limit}
                    onChange={(event) =>
                      send({
                        type: 'SET_LIMIT',
                        limit: Number(event.currentTarget.value),
                      })
                    }
                  >
                    {LIMITS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </Select>
                </Stack>
              </Flex>
              {state.context.allFiles.length ? (
                <Grid
                  gap={4}
                  style={{
                    marginTop: '2rem',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr)',
                  }}
                >
                  {state.context.allFiles.map((file) => (
                    <FilePreview
                      key={file._id}
                      file={file}
                      onEdit={(chosen) =>
                        send({
                          type: 'EDIT_FILE',
                          file: chosen,
                        })
                      }
                      onSelect={onSelect}
                    />
                  ))}
                </Grid>
              ) : (
                <Stack style={{ margin: '2rem 0 -1rem' }}>
                  <Text size={3} style={{ margin: '2rem auto' }}>
                    No files found
                  </Text>
                </Stack>
              )}
              {state.matches('uploading') && status === 'success' && (
                <Dialog
                  header="Upload new file"
                  zOffset={600000}
                  id="upload-dialog"
                  onClose={() => send('CLOSE_UPLOAD')}
                  onClickOutside={() => send('CLOSE_UPLOAD')}
                  width={1}
                >
                  <Card padding={3}>
                    <Uploader
                      accept={accept}
                      onSuccess={(document) =>
                        send({
                          type: 'UPLOADED',
                          file: document,
                        })
                      }
                      storeOriginalFilename={false}
                      vendorConfig={props.vendorConfig}
                    />
                  </Card>
                </Dialog>
              )}
              {state.matches('editingFile') && state.context.fileToEdit && (
                <FileDetails
                  closeDialog={() => send('CLEAR_FILE')}
                  file={state.context.fileToEdit}
                  onSelect={onSelect}
                  persistFileSave={(file) =>
                    send({
                      type: 'PERSIST_FILE_SAVE',
                      file,
                    })
                  }
                  persistFileDeletion={(file) =>
                    send({
                      type: 'PERSIST_FILE_DELETION',
                      file,
                    })
                  }
                  vendorConfig={props.vendorConfig}
                />
              )}
              {state.matches('editingSettings') && (
                <Dialog
                  header="Edit settings"
                  zOffset={600000}
                  id="settings-dialog"
                  onClose={() => send('CLOSE_SETTINGS')}
                  onClickOutside={() => send('CLOSE_SETTINGS')}
                  width={1}
                >
                  <ConfigureCredentials
                    onCredentialsSaved={(success) =>
                      success && send('CLOSE_SETTINGS')
                    }
                    vendorConfig={props.vendorConfig}
                  />
                </Dialog>
              )}
            </Container>
          )}
        </Flex>
      </Card>
    </ThemeProvider>
  )
}

export default Browser
